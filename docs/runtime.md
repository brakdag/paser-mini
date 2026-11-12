# Runtime reference

Configuration persistence, diagnostics, MCP connections and request limits. For
installation, credentials and configuration scopes, see the [operating reference](operations.md).

## Session history and diagnostics

`.paser-mini/log/session.log` keeps the conversation and model tool events for context recovery. Its format and recording behavior are unchanged.

The technical file `.paser-mini/log/paser_mini.log` is **disabled by default**. Existing technical logs are left untouched in normal use. Enable diagnostics explicitly when investigating a problem:

```bash
PASER_MINI_LOG_LEVEL=debug paser_mini
```

Available levels: `off` (default), `error`, `warn`, `info`, `debug`. Unknown values disable diagnostics. Set the variable in the launch environment. Diagnostics retain at most three files of 1 MiB each (`paser_mini.log`, `.1`, `.2`), with entries capped at 16 KiB. Enabling diagnostics discards oversized legacy technical logs. Full request payload dumps have been removed from Cohere, OpenRouter, Poolside and ZenMux.

Technical writes are synchronous and bounded, with no pending write queue. Concurrent instances skip diagnostic entries while another writer holds `.paser-mini/log/paser_mini.log.lock`. If a process is forcibly killed while holding that lock, remove the leftover lock only after stopping all Paser Mini instances in that project. Technical I/O failures disable diagnostics for that process and print one warning; session logging continues independently.

To reclaim space from old diagnostics, stop Paser Mini and delete only `paser_mini.log`, `paser_mini.log.1` and `paser_mini.log.2` inside `.paser-mini/log/`. Keep `session.log` and `memento.log` for context and memory.

Memory writes to `memento.log` are serialized per log directory within one process,
including separate manager instances and directory symlinks. Concurrent calls keep
their entry IDs and reference ranks in order. A failed operation rejects its caller
and allows subsequent calls to proceed. This is not a cross-process lock: run only
one Paser Mini process per project when storing memories. Writes are not transactional
across disk failures; a failed append can leave reference ranks already updated.

## Configuration persistence

Global settings live in `~/.paser-mini/config.json`; project settings live in
`.paser-mini/config/config.json`. Missing files start with empty settings. Invalid
JSON, a root other than an object, or a read error stops startup with the file path;
the existing file is preserved for repair.

Saving writes and synchronizes a unique temporary file in the destination directory
before replacing the JSON with an atomic rename. A failed write leaves the previous
file and the manager's saved values intact, and removes the temporary file when
cleanup succeeds. New files use permissions `0600`; replacements preserve existing
permission bits and follow existing file symlinks. Constructing `ConfigManager`
only reads; it does not create directories or migrate settings. CLI startup
explicitly calls `migrateGlobalKeys()` to move legacy global keys out of project
configuration. Embedded callers can invoke that method when appropriate; legacy
values remain readable without migration, with global settings taking precedence.
The global copy is saved before removing local keys, so an interrupted migration
can resume on the next startup. Repeating a completed migration does not write files.

Each file is replaced independently. This does not coordinate concurrent writers or
provide a transaction across both files or a durability guarantee after power loss.
A forcibly terminated process may leave a `.paser-config-*.tmp` file beside the
configuration; with Paser Mini stopped, such leftover temporary files can be removed.

## MCP server environment

Local stdio servers in `.paser-mini/config/mcp.json` can define an `env` object:

```json
{
  "mcpServers": {
    "local": {
      "command": "my-mcp-server",
      "env": { "API_KEY": "${MY_MCP_API_KEY}", "MODE": "local" }
    }
  }
}
```

Values such as `${MY_MCP_API_KEY}` resolve from the Paser Mini process environment.
The MCP SDK adds its default inherited variables (including `PATH`); explicit
`env` entries override those defaults for the child process only. Omitting `env`
keeps the SDK defaults. Unset references remain literal and emit a diagnostic
warning when warning logs are enabled. HTTP servers use `headers` instead.

MCP connections are reconciled whenever the system prompt is built or rebuilt.
Disabling or removing a server (including removing `mcp.json`) retires its tools;
changing its resolved connection settings reconnects it. Invalid configuration
keeps existing connections and logs a diagnostic. Failed connection or discovery
attempts close the client and can be retried on the next prompt rebuild. There is
no background reconnection loop. An unexpected connection close immediately
retires its executable tools; the prompt catalog refreshes on its next rebuild.

Names exposed to the model use `mcp_<server>_<tool>`, replacing characters outside
`A-Z`, `a-z`, `0-9` and `_` with `_`. The original remote tool name is used for
requests. Colliding normalized server names, duplicate tool names and collisions
across server/tool boundaries reject the new connection without overwriting an
active one. Servers are initialized in configuration order. Discovery publishes
all tools together; disconnect and shutdown remove only that connection's tools
and invalidate previously copied functions. MCP lifecycle operations are
serialized to prevent duplicate connections and late discovery after disconnect.
See the [operating reference](operations.md#history-context-and-tool-effects) for
the application-wide shutdown deadline and resource cleanup.

Tool results preserve ordered content blocks and remote error status through the
engine, terminal and adapters. Image transmission is implemented for Gemini and
OpenRouter; other adapters explain unsupported media and retain originals in
in-memory history. See [tool results and media](tool-results.md) for the
contract, resource handling and Fountain/QR behavior.

## Command Line Arguments
| Argument | Short | Description |
| :--- | :--- | :--- |
| `--message` | `-m` | Initial message to send |
| `--system-instruction` | `-si` | Provide custom system instructions |
| `--inject-system-instruction` | `-isi` | Inject instruction at the start of system prompt |
| `--file-system-instruction` | `-fsi` | Path to file for system instruction injection |
| `--no-system-instruction` | `-nsi` | Pure chat: no system prompt, tools or MCP startup |
| `--github-mode` | | Run in GitHub mode (process issues with #ai-assistance) |

`--no-system-instruction` skips prompt injections and MCP initialization. Tool
syntax in replies is displayed as text. An explicitly empty custom prompt
(`--system-instruction ""`) keeps tools enabled. If both positive and negative
system instruction flags are present, the last one wins.

Use `/rewrite <message>` (or `/r <message>`) to replace the latest completed
turn, including its tool exchanges. If the replacement fails or is interrupted,
the previous conversation history is restored. Rewriting changes conversation
history; it does not undo file changes, commands or other tool side effects.
Imported, reset or manually changed history requires a new completed turn before
rewriting is available.

## GitHub batch mode

`--github-mode` takes one snapshot of open issues containing `#ai-assistance`,
processes each eligible issue through one complete agent turn, and exits. It uses
`GITHUB_TOKEN` and the repository's Git remote. Pull requests and issues already
labeled `paser-processing` are skipped. Issues and comments are paginated.

Sessions use the configured provider, model, temperature and identities; without
`model_name`, the selected provider's bundled default is used. Tool contexts are
initialized as in terminal mode. `--no-system-instruction` also disables tools
in GitHub mode. No terminal input is requested.

Comments finish publishing before the processing label is removed. Success adds
a completion receipt based on the issue title/body and comments from accounts
other than the authenticated bot. Unchanged completed inputs are skipped on
later runs; edits or new comments allow another turn. Use a dedicated bot account
so human discussion is included. Failures receive an error comment when possible,
release the label and cause a nonzero exit after the remaining issues are tried.

Receipts prevent repeat processing after completed publications. They do not make
tool effects transactional: a failed publication or interrupted run can leave
partial work that is retried. Processing labels are advisory, so run one worker
per repository. API requests have a 30-second timeout; list traversal fails
explicitly after 1,000 pages rather than silently dropping further results.

## Switching models and cancelling requests

Use `/models` to interrupt a pending request, rate-limit wait or retry wait with
any provider and list models.
Select one with `/models <index>`, or switch directly with
`/models models/<model-name> [temperature]`. Switching by name does not require
fetching the model list. The pending request is cancelled; send your next message
after switching. Earlier conversation history remains available.

Gemini restores the history from before a failed send. Safety and empty responses
show an error in the UI and trigger one rephrase request. A failed rephrase is
propagated without further recovery. Transport errors retain their original
cause, HTTP response and error code; interruptions propagate without rephrasing.

## Request retries and deadlines

`RetryHandler` is the only transport retry layer for all twelve providers;
`ApiCommunicator` sends once and Z.AI no longer installs Axios retry interceptors.
Each `sendMessage` permits **five total transport attempts** and **ten minutes
total**, including rate limiting, requests and backoff. The monotonic budget is
created before preparing the request and never resets between attempts. The
existing per-transport timeout may end an individual attempt sooner. Programmatic
callers can set `adapter.retryHandler.maxRetries` (total attempts), `maxDelay`
(local backoff cap) and `maxElapsedMs` before sending; time must be a positive
integer within Node's timer range. These are not CLI/config-file options.

Retryable failures are HTTP 429/500/502/503/504, recognized connection errors and
provider-specific degraded/empty-response policies. Other HTTP statuses and
cancellation are terminal, even when their text matches a recoverable error.
Backoff starts at two seconds and doubles to a five-minute cap. `Retry-After`
accepts seconds or an HTTP date and is a minimum delay, even beyond that cap.
If the required delay cannot fit in the remaining budget, the request fails
with `TimeoutError` immediately, without retrying early or waiting uselessly.
No retry is announced or delayed after the final attempt.

Cancellation and expiry reach Axios, NVIDIA's REST client, rate limiting and
backoff. Failed/cancelled requests restore the prior history, including messages
removed by context preparation; late responses are discarded before committing
history. A custom transport that ignores `AbortSignal` must settle before the
adapter is released, so it cannot later overwrite a new request's history.
Production transports use Axios cancellation. Timers are cleared after settlement.

The retry policy explicitly allows repeating model-generation POST requests:
a connection failure can leave a generation running remotely, and retrying may
create another billable generation. Local tool execution is outside this layer
and is never replayed by transport retries. Model/domain recovery remains a
separate model exchange with its own transport retry budget.

## Unlimited turns and interruption

Normal sessions have no automatic limit on tool calls, model exchanges,
elapsed turn duration, consecutive tool errors, or repeated calls and responses.
Tool and argument errors are returned to the model so it can continue.
The agent continues until it produces a response without tool calls or the user
interrupts it. Every new user turn starts with fresh counters. Disabled repetition
detectors do not retain attempt maps, result fingerprints or prose buffers.

Queued input or explicit turn cancellation prevents the next tool or model
exchange. `/models` also cancels active provider transports and their waits.
Each model request has the separate [transport deadline](#request-retries-and-deadlines);
`run` has its own [OS termination policy](local-tools.md#run-execution-policy). Completed tool effects are not rolled
back when a turn stops. Programmatic callers can explicitly opt into finite limits
using positive integers as the final `TurnProcessor` constructor argument;
`Infinity` disables each limit. Normal CLI sessions do not enable these limits.
