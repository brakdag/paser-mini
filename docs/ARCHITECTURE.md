# Detailed Technical Architecture

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
- **`instance_tools.py`**: Enables "inception" capabilities. Allows launching a new `paser-mini` instance or any Python module/script. Supports a secure WebAssembly sandbox mode via Wasmer.

### ↻ Data Flow

`User Input` $\rightarrow$ `TerminalUI` $\rightarrow$ `ChatManager` $\rightarrow$ `GeminiAdapter` $\rightarrow$ `ToolParser` (if tool call) $\rightarrow$ `AVAILABLE_TOOLS` $\rightarrow$ `ChatManager` (loop) $\rightarrow$ `Final Response` $\rightarrow$ `TerminalUI`.