# Local tool reference

Tool syntax, file access and execution policies. See also the
[operating reference](operations.md#argument-names-and-compatibility) for argument aliases
and the [result/media contract](tool-results.md).

## Analysis and documentation tools

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

## File indexing and batch loading

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

## Local tool call contract

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

For a guided console session, type `/run fastfetch` or `/run git status`.
`/run` always executes the command you wrote, independently of `/execute`, pure
chat mode, and the agent's tool catalog. It does not enable shell access for the
agent. The command runs in the project directory using `$SHELL -lc` (a login
shell, falling back to `/bin/sh` when `$SHELL` is unset). It inherits the process
environment and loads the shell's login profile, including configured `PATH`
entries. On Windows it uses the default command shell. Commands retain
the existing 60-second timeout; it is intended for commands that finish without
interactive input. Each invocation starts a new shell, so `cd` and environment
changes do not persist across invocations. Quotes, pipes and shell expressions
are passed directly to the shell. Both stdout and stderr are displayed and saved
with the command in conversation history, including failures. The AI then
receives a request to explain the result and suggest the next command for you to
type. Keep `/execute off` if you want to reserve shell execution for yourself.

For a persistent remote shell, use an interactive terminal:

```text
/ssh connect user@192.168.100.18
/ssh run cd /var/log
/ssh run pwd
/ssh run uname -a
/ssh status
/ssh disconnect
```

`/ssh` requires the local OpenSSH client (`ssh`), a remote POSIX `sh` and `stty`,
and the `node-pty` dependency (installation may require native build tools).
SSH uses your normal keys, agent, host verification and `~/.ssh/config`; aliases
in that file can configure ports, identity files and jump hosts. One connection
belongs to each chat session. Directory changes and exported variables survive
between `/ssh run` commands; reconnecting starts a fresh shell. `/run` continues
to execute locally. The remote terminal uses POSIX `sh`; changing its `PS1` prompt
or replacing the shell can interrupt command completion detection (use `Ctrl+]`
to disconnect). SSH is a manual command, available even with `/execute off`
or in pure chat mode; it does not give the AI a remote execution tool.

While connecting or running a remote command, keyboard input goes directly to
SSH, so you can answer host verification, passwords, passphrases and interactive
prompts such as `sudo`. These raw keystrokes bypass chat history and logging.
Authentication output is not sent to the AI. Remote command output and the
command you submit are shared with the AI, including errors; avoid putting secrets
directly in command arguments or printing them. The AI explains each result and
waits for your next command. Commands have no fixed execution deadline; `Ctrl+C`
is sent to the remote terminal and **`Ctrl+]` disconnects and returns to chat**.
The connection handshake has a two-minute deadline. Exiting the app also closes
SSH. A lost connection is reported and requires an explicit reconnect; commands
are never retried automatically. Up to one million characters of each command's
output are retained for AI context while terminal output streams live.
Interactive prompts work directly; full-screen applications are best used from
a standalone terminal because this chat does not emulate a screen.

`/tool execute("git status")` still follows agent tool permissions. `/tool`
now saves the tool call and result in conversation history, including status,
metadata and media blocks, so the AI sees them on your next message. It does
not request an immediate AI response.

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

## Project path policy

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
links. Application-owned persistence writes its own state directly. Shell commands, debugger commands and code launched by analysis/documentation
tools still run with the user's permissions.

## Run execution policy

`run` requires Linux, `/usr/bin/bwrap` (Bubblewrap with `--disable-userns`),
`/usr/bin/prlimit` (util-linux), and enabled unprivileged user namespaces.
It fails explicitly if isolation cannot be established; there is no in-process
fallback. Each call gets a fresh JavaScript context and a separate mount, PID,
network, IPC and user namespace. The project is writable; existing top-level protected
metadata entries are mounted read-only. `/usr` and runtime libraries are
read-only, `/tmp` and `/dev` are private, and the host home, environment and
network are not inherited. Project-local secrets remain readable: choose the
project root accordingly. External symlinks cannot expose unmounted host paths.
Do not use a project containing hard links to sensitive external files or host
Unix sockets: a writable project mount retains those inode capabilities.

The total deadline is 5 seconds (including setup), with a 1-second synchronous
VM limit. Namespace processes, including detached descendants and unawaited
work, terminate after success, failure or deadline. Source and combined output
are limited to 1 MiB each. JavaScript runs without JIT, with a 64 MiB V8 heap;
hard per-process limits are 1 GiB address space, 5 CPU seconds, 16 MiB per file,
64 open descriptors, 256 processes/threads per real UID, and no core dumps.
These are not aggregate RAM or project-disk quotas. File effects completed
before termination persist. Globals no longer persist between calls.
This policy relies on the host kernel and installed runtime; it does not
isolate `execute` or provide a virtual machine for hostile native software.
