# Operating reference

Paser Mini targets Debian/Linux and Node 24.x or 26.x. Run `npm ci --ignore-scripts`
inside the clone; run `npm start` there or use the launcher installed by
`bash install.sh`. Run `paser-mini` from the project you want the agent to access:
project paths and state are based on that working directory, while bundled code
is resolved from the installation. The installer requires an existing clone;
piping its script into a shell from an unrelated directory does not clone it.
`paser_mini` remains an alias in npm's bin mapping. Do not assume bundled default
model names are currently offered by a provider; select an available model using
`/models` and configure credentials for that provider.

## Executables and credentials

| Feature | Required executable or configuration |
| --- | --- |
| CLI and installer | Node 24/26, npm; installer also uses Bash, `readlink -f`, `dirname`, `mkdir`, `ln`, `chmod` |
| Git tools and test fixtures | `git` |
| Text search | GNU `grep`; globs are handled in JavaScript |
| Web search and HTML rendering | `elinks`; search queries contact DuckDuckGo with Brave fallback |
| PDF text extraction | `pdftotext` (Debian package `poppler-utils`) |
| Image conversion and cropping | ImageMagick `convert` and `identify` |
| Sound notification | An available `aplay`, `afplay` or `play`; the bundled sound is currently looked up under the project `src/assets/type.wav` |
| JS/TS analysis, lint, documentation | Declared local TypeScript, ESLint and JSDoc dependencies; no implicit `npx` installation |
| Node inspection | `node` on PATH; the inspector launches it as a child process |
| MCP | Commands or HTTP endpoints configured by the user in `.paser-mini/config/mcp.json` |

Missing feature-specific executables fail when that tool is used; they are not
all needed for ordinary chat. Tests replace network, image and sound services
with local fakes. Tests still need Git, GNU grep and permission to start local
subprocesses. A sandbox blocking `spawnSync` can produce `EPERM`; that failure
alone does not indicate a filesystem mounted read-only or a damaged device.

Credentials are read from the launch environment; `dotenv/config` also reads
the project `.env` at startup. Keep credentials out of version control.

| Provider ID | Environment variables |
| --- | --- |
| `GEMINI` | `GEMINI_API_KEY`, falling back to `GOOGLE_API_KEY` |
| `NVIDIA`, `NVIDIA_MINIMAX` | `NVIDIA_API_KEY` |
| `HUGGINGFACE` | `HUGGINGFACE_API_KEY` |
| `OPENROUTER` | `OPENROUTER_API_KEY` |
| `GROQ` | `GROQ_API_KEY` |
| `CEREBRAS` | `CEREBRAS_API_KEY` |
| `COHERE` | `COHERE_API_KEY` |
| `CLOUDFLARE` | `CLOUDFLARE_API_KEY`, `CLOUDFLARE_ACCOUNT_ID` |
| `ZAI` | `ZAI_API_KEY`; optional `ZAI_BASE_URL` and `ZAI_CODING_PLAN` |
| `POOLSIDE` | `POOLSIDE_API_KEY` |
| `ZENMUX` | `ZENMUX_API_KEY` |
| GitHub tools/batch mode | `GITHUB_TOKEN` and a repository Git remote, or an explicit repository argument |

## Configuration scopes

Global keys are `favorites`, `fetch_headers`, `unavailable_models`,
`user_nickname` and `agent_nickname`. They live in `~/.paser-mini/config.json`;
legacy project values are readable until startup migrates them, and existing
global values win. Other settings live in `.paser-mini/config/config.json`:
`provider`, `model_name`, `default_temperature`, `rendering_mode`,
`immersion_mode`, `execute_enabled`, `rpm_limit`, `context_window_limit` and
`max_tokens`. Embedded callers can set temporary values without saving them.
Changing files externally does not reload an existing ConfigManager;
`/reload` rebuilds the prompt/catalog, not this JSON configuration instance.
The shared `model.temperature` is the session's temperature source;
`session.temperature` remains a read-only accessor for existing integrations.

With `/true` enabled in IRC mode, the model still receives timestamps and nicks
on conversation messages. Leading `[HH:mm] <agent>` headers echoed by the model
(also accepting seconds) are removed before its reply is stored or displayed;
the application adds one header when formatting the message. Repeated leading
headers matching the exact current agent nick are removed. Quoted/fenced or
indented code, other speakers and headers inside the body remain untouched.
Old duplicated assistant text is also normalized when preparing IRC payloads;
existing log files are not rewritten. This normalization is specific to immersed
IRC and does not alter CLEAN, Fountain or non-immersive responses.

`timestamps_enabled`, `safemode` and `instance_timeout` do not control current
execution; old saved values are left untouched. Shell execution is gated by
`execute_enabled`; pure mode disables tool execution. Neither flag creates an
operating-system sandbox. Persistence and concurrent-writer limitations are
documented in the README; use one writer process per project.

## Argument names and compatibility

New single-resource tools use `path`; names with multiple meanings use explicit
camelCase names. Positional calls keep their order and meaning. The generated
catalog advertises the canonical names below; named callers use the schema
registry to normalize supported legacy names before validation. The parser's
positional builder also accepts these names for existing engine callers.

| Tool | Canonical arguments | Supported legacy named arguments |
| --- | --- | --- |
| `restore`, `zip` | `path` | `restore.filepath`, `zip.filePath` |
| `bin` | `action, path, offset, length, end, endianness, outputFile, pattern, hexString, type` | `filePath` → `path` |
| `structure`, `node`, `arrange` | `filePath, nodePath` | `file_path` → `filePath`, `path` → `nodePath` |
| `update` | `filePath, nodePath, value` | Same JSON aliases |

For example, `node("config.json", "items.0")` is unchanged. Named input
`{file_path: "config.json", path: "items.0"}` normalizes to
`{filePath: "config.json", nodePath: "items.0"}`. Duplicate names with equal
values are accepted; different values are rejected before invocation. Other
unknown fields remain subject to each tool's schema. These aliases are deliberate
compatibility, not additional tool names. `eval`, `real`, `ls` and `difference`
are not tool names. GitHub fields such as `issue_number` retain the established
API contract; existing non-path names have not been changed cosmetically.

## History, context and tool effects

History is kept in memory by the adapter. `session.log` records conversation and
tool events, and `memento.log` stores distilled memory. Startup does not replay
those logs automatically; `/c` asks the agent to read the session log. `/reset`
clears conversation history and retains the current system prompt. The model's
`reset(user_message)` tool also queues a new user message and resets its tool
tracker. `/rewrite` replaces the last tracked complete turn and restores its
history if replacement fails; it does not undo filesystem, network or command
effects. `/connect`, `/models` and loading a favorite prepare a replacement adapter
before publishing it. They retain identities, rendering/immersion, tool policy,
catalog and execution permission. A creation, initialization or context-budget
failure leaves the previous adapter and conversation usable. No remote health
probe is performed; initialization may consult provider metadata (Cerebras).
Credentials and generation availability are checked on the next model request.

Changing model or temperature within the same provider preserves the native
history, including media and turn identifiers. Changing provider restarts the
conversation and displays a notice; history is not converted between formats.
Session logs are retained. A successful switch clears the `/rewrite` target and
tool/repetition tracking. Reconfiguration requires an idle session (overlapping
operations are rejected). Reloading prompt/tools preserves history and updates the
pure-mode execution policy together; tools are loaded lazily when leaving pure
mode. Adapter initialization and prompt/tool reconfiguration are awaited.

`/trunc n` sets a common estimated budget across all twelve providers. The
allowance includes normalized serialized content, framing, the actual output
reserve and 500 protocol tokens. Media adds 2,048 estimated tokens per block
in addition to its serialized size. These are heuristics, not tokenizer counts
or guarantees of provider acceptance. All `parts`, text and content blocks
participate in the estimate; final provider payloads are checked again,
including formatting, system fields and tool schemas.

Trimming first removes complete older user turns, including tool/recovery
exchanges. If the active turn still exceeds the budget, its text is shortened
with a `[Context truncated]` marker, retaining the beginning and end. The final
formatted request is shortened again when formatting adds overhead. This policy
also applies to imported history. System/developer instructions, media, tool
schemas and protocol structure are preserved; each text block retains at least
128 characters (or its full text if shorter). These mandatory fields and the
output/protocol reserve impose a soft minimum, so very small limits may be
exceeded. A long active turn with many tool exchanges can also exceed the target
because each message and its minimum text are preserved. The final request check
reports the estimated total including reserves when this happens. Trimming and
minimum-over-budget notices each appear once per active turn and budget setting,
including retries; subsequent requests still apply the policy silently. Text
already at its minimum does not trigger a trimming notice.
A local budget never raises `CONTEXT_BUDGET` or stops the agent loop.
Provider limits and transport errors still apply; failed transport restores
history removed or shortened during preparation. Already completed tool effects
persist. `max_tokens` must be a positive integer; any nonnegative integer local
budget is accepted, including values below the output reserve.

`0` disables the local budget; the UI says so without a percentage against an
invented model capacity. With a limit enabled, the UI includes the output and
protocol reserve in its estimate. Provider limits still apply. See the
[result/media contract](tool-results.md) for block preservation, adapter
projections and explicit unsupported-content responses.

| Operation | Observable effects |
| --- | --- |
| File, JSON, binary extraction, patch and Git restore tools | Modify project files; path policy applies, with protected metadata exclusions |
| `run` | Requires Linux/Bubblewrap/prlimit; fresh isolated process per call, writable project, read-only top-level protected metadata/runtime, no host network/environment; terminates namespace processes within 5 seconds; completed file effects persist. See README for limits and project inode caveats |
| `execute`, inspector commands | Execute with user permissions; arbitrary code can access resources beyond convenience path helpers |
| `doc`, `snapshot` | Write generated HTML or heap snapshots to the requested validated destination |
| `fetch`, `url`, `search` | Make network requests and may start renderers; results use the documented limits and cache policies |
| GitHub create/edit/close/post | Publish changes to the selected remote repository |
| `notify` | Starts asynchronous audio playback when its project sound and player are available |
| `push` | Appends to memory and may update ranks of referenced entries |
| `/s [file]` | Saves the last request payload, including conversation content, to JSON; defaults to `last_request.json` |
| `/cache`, `/reload` | Rebuild prompt/catalog from startup options and role/MCP files; preserve conversation; no JS module reload |
| `reloadSchemas()` | Re-register schemas from already loaded modules; edited JS requires a restart |
| `reloadTools()` | Close cached tool resources before clearing instances; it does not reload ESM modules or automatically rebind session contexts |

Only `/execute` controls the shell tool; it does not gate every tool that can
execute code or modify files. Completed effects persist when a turn fails or
is cancelled. Model requests share five total attempts and a ten-minute deadline
covering transport and waits; `/models` cancels them for every provider. See the
README request retry policy for programmatic limits and remote generation effects.
EOF, `/exit` (and its aliases), SIGINT/SIGTERM, startup failures and unhandled
process errors use one idempotent application shutdown. EOF drains queued input
and the current turn before shutdown; `/exit` and termination signals cancel the
active turn. Shutdown closes readline/spinners, saves the prompt cache, closes
MCP (including connections still being discovered), closes instantiated tool resources and
awaits the session log flush. Fatal failures exit with status 1; normal exits
and handled termination signals use 0. Cleanup failure or timeout also uses 1.
The total cleanup deadline is five seconds; the last second is reserved for
log flushing if another resource stalls. The executable terminates after cleanup,
so a stalled resource cannot keep the CLI alive. A forced deadline or externally
sent SIGKILL cannot guarantee buffered writes complete. `run` also has its own
terminating OS deadline. User commands that intentionally launch independent
background services retain their external effects.

Each terminal UI owns its input. Importing application/domain modules does not
open a session file or install process exception/signal handlers. The executable
starts logging explicitly; programmatic callers can start the logger or let the
first accepted write open it, and await `shutdownStreams()` when done.

Compatible chat-completions adapters compose the shared request transport and
history policies in `compatibleChat.js`; Gemini, Cohere and specialized provider
payloads retain their own mapping. Local default model choices live in
`providerDefaults.js` and are shared by the factory and adapters. They are local
fallbacks, not a check that those models remain remotely available.

## Generated files and quality configuration

`eslint.config.js` is the only lint configuration; `jsconfig.json` and the
reviewed type baseline provide incremental JS type control. Run
`npm run check` before integration. Its test runner uses a temporary project and
HOME; local credentials and state are excluded. No generated credentials or
logs are removed as part of maintenance.

`.gitignore` excludes `.paser-mini/` at any depth (including old state under
`src/core`), `.env` files except `.env.example`, default payload JSON,
`docs/api/`, heap snapshots and `node_modules/`. Custom output paths are the
caller's responsibility. `bin/paser-mini` is a tracked portable launcher;
the installer recreates the same wrapper and creates a local symlink outside
the checkout. Ignoring a path does not remove already tracked files or delete
existing logs. Keep session/memory logs unless deliberately managing that data.
