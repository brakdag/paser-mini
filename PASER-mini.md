# Paser Mini (Extreme Minimalist Autonomous Agent)

<div align="center">
  <img src="assets/mascot.png" alt="Paser Mini Mascot" width="200"/>
</div>

**Paser Mini** is a highly streamlined fork of the original Paser system. It is an autonomous agent powered by Google's Gemini model that employs the **ReAct (Reasoning and Acting)** pattern to execute local functions with zero overhead and maximum efficiency.

Designed for developers who want a lightweight, distraction-free autonomous core on **Debian/Linux** systems.

## Installation

Installation is now near-instant as all heavy system dependencies have been removed.

### Quick Installation

```bash
curl -fsSL https://raw.githubusercontent.com/brakdag/paser-mini/main/install.sh | bash
```

### Clone from Repository

```bash
git clone https://github.com/brakdag/paser-mini.git && cd paser-mini && chmod +x install.sh && ./install.sh
```

## Credentials Configuration

Configure your API key in your `.bashrc` or `.zshrc`:

```bash
export GOOGLE_API_KEY="your_google_api_key_here"
```

## Execution

Run the application using the newly created binary:

```bash
paser-mini
```

### Command Line Arguments

| Argument | Short | Description |
| :--- | :--- | :--- |
| `--version` | N/A | Show version information |
| `--unit_tests` | N/A | Run the internal unit test suite |
| `--system_instruction` | `-si` | Provide custom system instructions to the agent |
| `--inject_system_instruction` | `-isi` | Inject instruction at the start of system prompt |
| `--message` | `-m` | Send an initial message in one-shot mode |
| `input` | N/A | Positional argument for input text in one-shot mode |

**Example (One-shot mode):**
```bash
paser-mini "Analyze the current directory and summarize the project"
```

## Project Structure

```text
. 
├── paser/                # Core application package
│   ├── core/             # Unified ReAct engine and state management
│   ├── tools/            # Minimalist toolset and registry
│   │   ├── file_tools.py # Essential file operations
│   │   ├── system_tools.py # Basic system analysis (Pyright)
│   │   ├── util_tools.py # Core utilities
│   │   └── registry.py   # Tool mapping
│   ├── infrastructure/   # System wrappers
│   ├── config/           # Settings
│   └── main.py           # Entry point
├── tests/                # Test suite
├── scripts/              # Maintenance scripts
└── pyproject.toml        # Metadata
```

## Detailed Technical Architecture

This project follows a modular ReAct (Reasoning and Acting) architecture. Below is the detailed breakdown of the components:

### ⚙️ Core Engine (`paser/core/`)
- **`chat_manager.py`**: The central orchestrator. It manages the conversation loop, handles tool execution asynchronously, and prevents infinite loops via `RepetitionDetector`.
- **`tool_parser.py`**: Responsible for parsing `<TOOL_CALL>` tags from the LLM and formatting `<TOOL_RESPONSE>` tags for the model.
- **`terminal_ui.py`**: A high-fidelity terminal interface using `rich` and `prompt_toolkit`, featuring real-time tool monitoring (spinners) and LaTeX rendering.
- **`commands.py`**: Implements the internal command system (e.g., `/models`, `/s`, `/t`) to modify agent state without affecting the chat history.
- **`config_manager.py`**: Handles the persistence of user preferences (model, temperature) in `config/config.json`.

### 💠 Infrastructure (`paser/infrastructure/gemini/`)
- **`adapter.py`**: The `GeminiAdapter` class abstracts the Google GenAI API, managing chat sessions, history, and model configuration.
- **`retry_handler.py` & `errors.py`**: Provide a robust layer to handle API rate limits and connectivity issues with exponential backoff.
- **`snapshot_manager.py`**: Allows saving and loading of interaction snapshots for debugging and persistence.

### 💡 Toolbox (`paser/tools/`)
- **`registry.py`**: The source of truth for available tools and the `SYSTEM_INSTRUCTION` that defines the agent's persona and protocol.
- **`file_tools.py`**: Implements secure file operations (read, write, replace, delete) restricted to the project root via `context.get_safe_path`.
- **`search_tools.py`**: Wraps system utilities like `grep` and `find` for efficient global searching.
- **`system_tools.py`**: Integrates `pyright` for static type analysis of the codebase.
- **`instance_tools.py`**: Enables "inception" capabilities, allowing the agent to launch a new `paser-mini` instance to test code or delegate tasks.

### ↻ Data Flow
`User Input` $\rightarrow$ `TerminalUI` $\rightarrow$ `ChatManager` $\rightarrow$ `GeminiAdapter` $\rightarrow$ `ToolParser` (if tool call) $\rightarrow$ `AVAILABLE_TOOLS` $\rightarrow$ `ChatManager` (loop) $\rightarrow$ `Final Response` $\rightarrow$ `TerminalUI`.

## Main Features

1.  **Minimalist UI:**
    - **Enhanced Visuals**: Supports Markdown rendering, JetBrains Nerd Fonts, and basic LaTeX symbols (e.g., $\rightarrow$, $\Rightarrow$) for a clean yet expressive interface.
    - **Silent Execution**: No tool-call logs, no "Working" indicators. The agent works in total silence until the final response.
    - **Minimal Prompt**: A simple `> ` prompt for a distraction-free experience.

2.  **Pure ReAct Engine:**
    - Uses structured `<TOOL_CALL>` emissions via System Instructions.
    - Optimized for low latency and minimal token consumption.

3.  **Secure File Access:**
    - All operations are restricted to `PROJECT_ROOT` via `get_safe_path` validation.

## Essential User Commands

- `/help`: Show the available commands menu.
- `/models`: Change AI model and adjust temperature.
- `/s`: Save a snapshot of the last interaction (System + History + Last Message + Response) to the current directory as a `.text` file.
- `/t`: Display the current context window token count.
- `/q`, `/quit`, `/exit`: Exit the application.

## Minimal Toolset

To maintain extreme lightness, only the absolute core tools are included:

### 📂 File System
- **Reading**: `read_file`.
- **Writing**: `write_file`, `remove_file`, `create_dir`, `rename_path`.
- **Navigation**: `list_dir`, `get_cwd`.

### ✂️ Basic Editing
- **Modification**: `replace_string` (Surgical text replacement).

### 🔍 Search & Analysis
- **Search**: `search_files_pattern`, `search_text_global`.
- **Analysis**: `analyze_pyright` (Static type checking).

### 🛠️ Core Utils
- **Validation**: `validate_json`.

## Development & Testing

Testing must be performed in a fresh environment. After any modification, please create a GitHub issue to delegate verification to a subsequent agent instance.

**Maintenance Note:** Whenever `README.md` is modified, `PASER-mini.md` must be updated with the same content to ensure consistency. This is a one-way synchronization (README $\rightarrow$ PASER-mini).
