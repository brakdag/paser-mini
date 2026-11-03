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
