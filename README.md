# Paser Mini (Extreme Minimalist Autonomous Agent)

## Mission
To engineer an autonomous, AI-driven agent of absolute minimalism and maximum efficiency, proving that a tiny, obsessed team can outperform bloated corporate monoliths by stripping away all operational noise and focusing purely on the intelligence loop.

## Scope of Operations
* **The Harvest:** Continuous profiling and analysis of token consumption, execution speed, and reasoning overhead to identify systemic bloat.
* **The Process:** Refactoring the core ReAct engine, CLI interface, and toolset to achieve zero-overhead execution on Debian/Linux environments.
* **The Insight:** Translating raw technical metrics into architectural shifts that maximize the ratio of user value to computational cost.

## Non-Goals
* **Empire Building:** We do not scale by adding headcount or management layers; we scale by increasing the efficiency of the existing loop.
* **Feature Creep:** We do not implement capabilities that do not directly serve the core ReAct reasoning cycle or the user's immediate friction-free interaction.
* **Cross-Platform Support:** We strictly target Debian/Linux to avoid the complexity and compromise of multi-platform maintenance.

## Operational Philosophy
Minimalism is not about the scarcity of tools or code, but about the maximum efficiency of token consumption. Every tool is strategically chosen to prevent unnecessary data from flooding the context window, ensuring the agent maintains peak reasoning capacity.

## Quality Management
- **Standard:** ISO 9001:2015
- **Lead:** Leo Thorne (Minimalist Auditor)
- **Objective:** Ensure that the minimalist agent architecture maintains absolute efficiency and zero-waste precision, eliminating operational noise through rigorous quality control.

<div align="center">
  <img src="docs/assets/mascot.png" alt="Paser Mini Mascot" width="200"/>
</div>

**Paser Mini** is a highly streamlined fork of the original Paser system. It is an autonomous agent powered by Google's Gemini model that employs the **ReAct (Reasoning and Acting)** pattern to execute local functions with zero overhead and maximum efficiency.

### ⚛️ The Philosophy of Minimalism
In Paser Mini, **minimalism is not about the scarcity of tools or code, but about the maximum efficiency of token consumption**. Every tool is strategically chosen to prevent unnecessary data from flooding the context window, ensuring the agent maintains peak reasoning capacity.

Furthermore, the system embraces an **AI-native interface**: a terminal-based environment using NerdFonts and Markdown—the formats where the AI feels most at home.

---

## 📈 Technical Documentation

### Installation and quality checks

Use Debian/Linux with Node **24.x or 26.x** and npm. These are the supported lines
in the [Node release schedule](https://nodejs.org/en/about/previous-releases).
Install the locked dependencies with `npm ci --ignore-scripts`, then run
`npm start`. Git and GNU grep must be available for the CLI tools and test suite;
audio, ImageMagick and network services are replaced by local fakes in tests.

`npm run check` runs lint, the reviewed JS type baseline and the complete test
suite. They can also be run separately as `npm run lint`, `npm run typecheck` and
`npm test`. CI runs the same checks on Node 24 and 26. `eslint.config.js` is the
only lint configuration. ESLint 9 is retained for Airbnb 3 compatibility.

`npm test` creates a temporary project and HOME, copies only test inputs and
application code, and links the installed dependencies. It does not copy project
configuration, logs, `.env` or user credentials, and does not pass credential
environment variables to the test process. It removes the temporary project on
completion. Tests have a 60-second deadline and the subprocess has a three-minute
deadline; no provider, GitHub, MCP or audio service is contacted.

Type control currently checks for changes against existing debt. It does **not**
mean TypeScript has zero errors. `npm run typecheck:raw` reports all existing
diagnostics and exits nonzero; [the reviewed baseline](docs/typechecking.md)
describes its scope, limitations and review process.

The `analysis(path)` tool uses the installed TypeScript compiler with `--noEmit`,
not Pyright. Files are checked as JS/TS; directories must contain `tsconfig.json`
or `jsconfig.json` (TypeScript config takes precedence). Compiler diagnostics are
returned as text. `doc(path, outputDir)` uses the installed JSDoc CLI and writes
HTML into the validated output directory. `eslint(path)` also uses the installed
CLI. These tools never invoke `npx` or install dependencies when called. TypeScript
and JSDoc are runtime dependencies, including when dev dependencies are omitted.

`ast(path, query, limit)` parses the complete JavaScript module for every query,
including `Identifier` and `Literal`; incomplete syntax is rejected even if the
result limit was already reached. Results keep `count`, `limit`, `results` and
`strategy: "ast_slow_path"`. The positive integer limit defaults to 100 and is
capped at 10,000. Booleans and null retain their JSON types, bigint values are
decimal strings, and regex values are `{pattern, flags}`. Unknown node types
return no matches. These are AST nodes rather than lexical token matches.

### Session history and diagnostics

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

### Configuration persistence

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

### File indexing and batch loading

`index(path, filter)` respects project and nested `.gitignore` files, including
globs, anchored rules and negations. Rules are case sensitive on Linux. Ancestor
rules still apply when indexing a subdirectory; an excluded parent directory must
be re-included before its children can be re-included. Git's global excludes and
`.git/info/exclude` are not read. Each rules file is limited to 64 KiB; an unreadable
or oversized nested rules file skips its subtree with a diagnostic.

`.git`, `.paser-mini`, `.codex`, `.agents` and `.aws` are always excluded at every
depth, even if negated in `.gitignore` or explicitly requested. Scanning skips
symlink entries; explicitly indexed directory aliases and symlinked project roots
remain supported within the project path policy.

An index includes at most 1,000 files, visits at most 10,000 directory entries,
descends at most 64 levels below the project root, and returns at most 512 KiB of
JSON. It preserves `total` and `files` and adds `truncated`, `diagnostics` and
`omittedDiagnostics`. At most 50 diagnostics fit within the same byte budget.
When truncated, index a narrower directory or use an extension filter. A failed
index invalidates the previous cached IDs; each successful index replaces them.

`load("0,1,2")` accepts at most 50 comma-separated nonnegative integer IDs and
deduplicates repeated IDs. Each source file is limited to 100 KiB; total output
is limited to 512 KiB, including decoded UTF-8, MIME headers, diagnostics and the
closing boundary. Whole files are omitted once the byte budget is reached, with
a `Batch truncated` part asking for a smaller batch. No file content is cut in half.

Deleted, changed, unreadable or replaced files produce per-file diagnostic parts;
other files in the batch continue to load. Metadata is checked against the index
and again around a bounded read. Re-index changed files before loading them.
These checks are not a filesystem snapshot. MIME `Content-Length` measures the
returned UTF-8 body and file names are escaped in headers.

Embedded callers can inject `fileSystem` and override `limits` on `LoadTools`:
`maxIndexFiles`, `maxIndexEntries`, `maxIndexBytes`, `maxDepth`, `maxBatchFiles` and
`maxBatchBytes`. Values must be positive safe integers; index/batch byte budgets
must be at least 2048/1024 and depth cannot exceed 128. Public tool arguments are
unchanged. Persistence supports one writer process per project; configuration
writers sharing a global file must also be coordinated by the caller.

### Installation
```bash
curl -fsSL https://raw.githubusercontent.com/brakdag/paser-mini/main/install.sh | bash
```
Or clone manually:
```bash
git clone https://github.com/brakdag/paser-mini.git && cd paser-mini && chmod +x install.sh && ./install.sh
```

### Credentials Configuration
Configure your API key in your `.bashrc` or `.zshrc`:
```bash
export GOOGLE_API_KEY="your_google_api_key_here"
```

### MCP server environment

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
The application-wide shutdown deadline and resource ownership remain separate
work tracked in `TODO.md` (T20).

### Command Line Arguments
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

### GitHub batch mode

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

### Switching models during Gemini retries

Use `/models` to interrupt a pending Gemini request or retry wait and list models.
Select one with `/models <index>`, or switch directly with
`/models models/<model-name> [temperature]`. Switching by name does not require
fetching the model list. The pending request is cancelled; send your next message
after switching. Earlier conversation history remains available.

Gemini restores the history from before a failed send. Safety and empty responses
show an error in the UI and trigger one rephrase request. A failed rephrase is
propagated without further recovery. Transport errors retain their original
cause, HTTP response and error code; interruptions propagate without rephrasing.

### Turn limits and interruption

Each turn allows up to 500 tool-call attempts (including invalid arguments),
500 model exchanges (including recovery), and 30 minutes of elapsed time.
Ten consecutive argument or execution failures stop the turn; a successful
execution resets only that error streak. The UI reports the stop reason and
returns control without requesting another recovery from the model.

Repeating a tool with the same arguments and unchanged output five times blocks
the next identical call. Changed output counts as progress, but a given call
still has a total cap of 100 attempts per turn. Argument property order does not
change its identity. This is a conservative repetition policy, not proof of
semantic progress: tools that legitimately return identical acknowledgements
are subject to the same limit. Every new turn starts with fresh counters.

Queued input or explicit turn cancellation prevents the next tool or model
exchange. `/models` also interrupts Gemini requests and retry waits. The deadline
is checked before and after exchanges and tool calls; it stops scheduling work
but cannot forcibly terminate a tool or transport already running. Provider retry
budgets, cancellation inside transports, and isolation of executed code remain
separate concerns (T12/T02). Completed tool effects are not rolled back when a
turn stops. Programmatic callers can supply positive integer limits and a
monotonic clock as the final `TurnProcessor` constructor argument.

## 🜰 Ecosystem Alignment
For the narrative history of this pod and the character breakdowns of the team, see the [Staff Directory](./docs/staff/).

### Local tool call contract

Tool calls need only an opening marker: `Əread("README.md")`. The closing
parenthesis ends the call; a trailing `ə` is optional for compatibility. Prefix
each call with `Ə`. Both schwa characters are reserved as markers and must not
appear inside tool arguments. Arguments are literal values
(strings, numbers, booleans, null, arrays and objects), with `undefined` for an
omitted positional parameter. Bare and dotted names remain accepted as strings.
Expressions, interpolation, spread arguments and incomplete blocks are rejected.

`src/infrastructure/toolDefinitions.js` binds each tool's description, schema,
parameter order and implementation. It replaces `registry_positional.json`.
The parser, validator, executable registry and generated prompt use this catalog.
`execute` remains hidden until `/execute` enables shell access.

`/reload` is an alias for `/cache`: both rebuild the system prompt and tool
catalog using the startup options, reread the role file and reconcile MCP
configuration, then save the startup cache. Conversation history is retained.
They do not reload JavaScript modules or change the provider or model; edited
modules require restarting. If rebuilding fails, the command reports the error
and leaves the session prompt and tool registry unchanged so it can be retried.

`concat(destination, source)` now appends the **source file's contents**, rather
than treating its path as text. Both paths must be inside the project and the
result is limited to 100 KiB. `push` accepts one argument. `reloadSchemas()`
re-registers bundled schemas; loading edited modules requires restarting.
`bin` preserves its flat public signature and adapts its last four parameters
into the implementation's options object. Its schema requires fields according
to the selected action.

AST analysis, ZIP listing, image inputs and the inspector's initial script follow
the same project-root path validation as file tools. External paths and symlinks
resolving outside the project are rejected. Internal symlinks remain supported,
including parent segments after a link. Image conversions use a separate temporary
directory per call and clean it up after success or failure.

The project root is fixed when the path policy is created; changing the process
working directory does not change it. Tests and embedded callers can create an
explicit policy with `new PathValidator({ root })`; `FileTools`, `SearchTools`,
`LoadTools` and `EvalTools` accept it as `{ pathValidator }`.

File mutations preserve the project root and any `.git`, `.paser-mini`, `.codex`,
`.agents` or `.aws` subtree, including aliases to those paths. Removing or moving
a parent containing such metadata is also refused before changing anything.
Other dot-prefixed names such as `..cache`, `.gitignore` and `.github` remain
editable. The same checks apply to JSON updates, binary extraction, heap snapshot
and documentation destinations, and the `BrowserFS` convenience helpers.
Mutation paths resolve parent components before use, preserving the final symlink,
so recursive parent creation does not create directories discarded by `..`.

Git `diff(path)` and `restore(path)` accept literal paths, including names with
wildcards; Git pathspec expressions are not expanded. Patches are parsed by Git
and their source/destination paths are validated before applying any changes.
Metadata changes and paths outside a project started in a repository subdirectory
are rejected. Git's own repository bookkeeping remains managed by Git.

This policy checks filesystem paths before use. It does not provide operating
system isolation against concurrent path changes or inode aliases such as hard
links. Application-owned persistence writes its own state directly. JavaScript,
shell commands, debugger commands and code launched by analysis/documentation
tools still run with the user's permissions; `run` isolation remains tracked in
T02 of `TODO.md`.
