# Paser (Autonomous Function Calling System - ReAct Pattern)

<div align="center">
  <img src="assets/mascot.png" alt="Paser Mascot" width="200"/>
</div>

**Paser** (originally called "Passer", after _Passer domesticus_) is an autonomous agent powered by Google's Gemini model (via the `google-genai` SDK) that employs the **ReAct (Reasoning and Acting)** pattern to execute local functions transparently for the user. Designed and optimized for **Debian/Linux** systems.

The name change from "Passer" to "Paser" (repository: `brakdag/passer`) simplifies terminal typing while maintaining the root of the original name and the meaning linked to the house sparrow, a very common bird in southern Mendoza.

## Installation

You can choose between cloning the repository (for development) or running the installation script directly:

### Option 1: Quick Installation (Recommended)

```bash
curl -fsSL https://raw.githubusercontent.com/brakdag/paser/main/install.sh | bash
```

### Option 2: Clone from Repository (For Development)

```bash
git clone https://github.com/brakdag/paser.git && cd paser && chmod +x install.sh && ./install.sh
```

## Credentials Configuration

To allow Paser to interact with external services, you must configure the following environment variables in your `.bashrc` or `.zshrc` file:

```bash
# API Key for the Gemini model
export GOOGLE_API_KEY="your_google_api_key_here"

# Personal access token for GitHub (required for managing issues)
export GITHUB_TOKEN="your_github_token_here"
```

## Execution

Once installed and configured, you can run the application simply by using:

```bash
paser
```

## Project Structure

```text
. 
├── paser/                # Main application package
│   ├── core/             # ReAct engine, agent orchestration and state management
│   ├── tools/            # Tool definitions, registry and semantic navigators
│   │   ├── file_tools.py # File system operations and surgical editing
│   │   ├── lsp_tools.py  # IDE-like introspection (Jedi integration)
│   │   ├── code_navigator.py # AST-based code analysis
│   │   └── registry.py   # Central tool mapping and system instructions
│   ├── infrastructure/   # Low-level system wrappers and API clients
│   ├── config/           # Application settings and environment config
│   └── main.py           # CLI entry point
├── tests/                # Unit and integration test suite
├── scripts/              # Installation and maintenance scripts
├── assets/               # Static assets and branding
├── docs/                 # Technical documentation
└── pyproject.toml        # Project metadata and dependencies
```

## Main Features

1.  **Local Function Calling (Manual):**
    - Does not use native Google SDK tools.
    - Uses _System Instructions_ to force the model to emit structured calls (`<TOOL_CALL>`).
    - The script acts as a _middleware_ that intercepts these calls, executes the local function, and returns the result in `<TOOL_RESPONSE>` format to the model's history.
    - *Note: Modifying `paser/tools/registry.py` autonomously can be unstable due to the tool interceptor (see [Issue #110](https://github.com/brakdag/passer/issues/110)). The complex string construction of `SYSTEM_INSTRUCTION` (using `chr()` and `.replace()`) is a mandatory workaround to prevent the middleware from misinterpreting the code as a tool call; do not simplify or "clean up" this implementation.*

2.  **Security and File Control:**
    - All file operations (read, write, delete) are restricted to the current working directory defined by `PROJECT_ROOT` through a secure path validation function (`get_safe_path`).
    - File deletion requires interactive confirmation (`y/n`).

3.  **User Commands:**
    - `/models`: Change the AI model and adjust temperature.
    - `/thinking`: Toggle the visibility of the model's internal reasoning (thoughts).
    - `/cd <path>`: Change the agent's working directory.
    - `/t`: Display the current context window token count.
    - `/history`: Show a summary of tools executed during the session.
    - `/session`: List and load previously saved sessions.
    - `/reset`: Save the current session and restart the application.
    - `/max_turns <n>`: Set the maximum number of autonomous turns to prevent infinite loops.
    - `/clear` or `/cls`: Clear the terminal screen.

## Tool Management

To maintain system stability and ensure the LLM correctly identifies available capabilities, follow these procedures when modifying the toolset:

### Adding a New Tool
1. **Implementation**: Define the Python function in the appropriate module within `paser/tools/` (e.g., `file_tools.py`, `web_tools.py`). Ensure strict type hinting for all arguments.
2. **Registry Mapping**: Add the tool to the `AVAILABLE_TOOLS` dictionary in `paser/tools/registry.py`, mapping the tool name (used by the LLM) to the actual function object.
3. **Metadata Definition**: Add the tool's metadata (name, description, and parameter types) to `paser/tools/registry_positional.json`. This file is used to generate the `TOOL_CATALOG` in the system prompt.
4. **Refresh**: Restart the application to reload the registry and update the system instructions sent to the model.

### Removing a Tool
1. **Registry Removal**: Delete the tool's entry from the `AVAILABLE_TOOLS` dictionary in `paser/tools/registry.py`.
2. **Metadata Cleanup**: Remove the corresponding entry from `paser/tools/registry_positional.json`.
3. **Code Cleanup**: (Optional) Delete the function implementation from the source file to keep the codebase clean.
4. **Refresh**: Restart the application.

## Development & Testing

**Important Note on Runtime Environment:**
Since the agent operates in a runtime environment that does not automatically reflect code changes upon rewriting, testing must be performed in a freshly initialized environment with a new agent instance. 

Consequently, after implementing any changes, the agent must always propose creating a GitHub issue to delegate testing to a subsequent agent to ensure the modifications are verified in a clean state.

## Available Tools

### 📂 Files & Directories

- **Reading**: `read_file(path)`, `read_files(paths)`, `read_lines(...)`, `read_head(...)`, `read_file_with_lines(path)`.
- **Writing & Editing**: `write_file(path, content)`, `update_line(...)`, `replace_string(...)`, `replace_string_at_line(...)`, `global_replace(...)`, `manage_imports(...)`, `copy_lines(...)`, `cut_lines(...)`, `paste_lines(...)`.
- **Path Management**: `list_dir(path)`, `create_dir(path)`, `rename_path(origin, destination)`, `remove_file(path)`, `get_tree(path)`, `get_cwd()`.
- **Search**: `search_files_pattern(pattern)`, `search_text_global(query)`.

### 🎨 Media & Interaction

- **Web & API**: `web_search(query)`, `fetch_url(url)`, `render_web_page(url)`, `api_request(...)`.
- **Vision**: `see_image(path)`, `convert_image(...)`.
- **Audio & Music**: `play_music(query)`, `stop_music()`, `speak_text(text, lang)`, `alert_sound()`.
- **System Interaction**: `notify_user(message)`, `notify_mobile(message)`, `set_timer(seconds, message)`, `is_window_in_focus(action)`, `compile_latex(path)`, `get_time(timezone)`.
- **Discovery**: `discover_capabilities(category)`: Lists available tools by category.

### 💻 Code & Engineering

- **Navigation**: `list_symbols(file_path)`, `get_definition(symbol, file)`, `get_references(symbol, file)`, `find_all_calls(symbol, file)`, `get_detailed_symbols(path)`, `get_imports(path)`.
- **Analysis & Quality**: `analyze_pyright(path)`, `find_missing_type_hints(path)`, `format_code(path)`, `validate_json(json_string)`, `validate_json_file(path)`.
- **LSP Introspection**: `get_lsp_completions(...)`, `get_object_methods(...)`.
- **Execution & AI**: `execute_python(code)`, `query_ai(prompt, ...)`.

### 🐙 GitHub & Version Control

- **Issue Management**: `list_issues(repo)`, `create_issue(repo, title, body)`, `close_issue(repo, issue_number)`, `edit_issue(...)`.
- **Git Operations**: `git_diff()`, `get_current_repo()`, `revert_file(path)`.
