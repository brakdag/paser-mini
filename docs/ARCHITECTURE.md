# Detailed Technical Architecture

This project follows a modular ReAct (Reasoning and Acting) architecture. Below is the detailed breakdown of the components:

### ⚙️ Core Engine (`src_js/core/`)

- **`chatManager.js`**: The central orchestrator. It manages the conversation loop, handles tool execution asynchronously, and prevents infinite loops via `RepetitionDetector`.
- **`smartParser.js`**: Implements a robust, single-pass JSON parser with auto-correction and schema validation for `<TOOL_CALL>` tags.
- **`terminalUI.js`**: A high-fidelity terminal interface using `chalk` and `ora`, featuring real-time tool monitoring (spinners) and Markdown rendering.
- **`commandHandler.js`**: Implements the internal command system (e.g., `/models`, `/s`, `/t`) to modify agent state without affecting the chat history.
- **`configManager.js`**: Handles the persistence of user preferences (model, temperature) in `config/config.json`.

### 💠 Infrastructure (`src_js/infrastructure/`)

- **`gemini/adapter.js`**: The `GeminiAdapter` class abstracts the Google GenAI API, managing chat sessions, history, and model configuration.
- **`memento/`**: Implements the Cognitive Graph using SQLite for persistent, distilled memory.
- **`nvidia/`**: Hardware-specific integrations for optimized LLM execution.

### 💡 Toolbox (`src_js/tools/`)

- **`registry.js`**: The source of truth for available tools and the `SYSTEM_INSTRUCTION` that defines the agent's persona and protocol.
- **`fileTools.js`**: Implements secure file operations (read, write, replace, delete) restricted to the project root.
- **`searchTools.js`**: Wraps system utilities for efficient global searching.
- **`systemTools.js`**: Integrates `pyright` for static type analysis of the JS/TS codebase.
- **`instanceTools.js`**: Enables "inception" capabilities, allowing the launching of new independent `paser-mini` instances.

### ↻ Data Flow

`User Input` $\rightarrow$ `TerminalUI` $\rightarrow$ `ChatManager` $\rightarrow$ `GeminiAdapter` $\rightarrow$ `SmartToolParser` (if tool call) $\rightarrow$ `AVAILABLE_TOOLS` $\rightarrow$ `ChatManager` (loop) $\rightarrow$ `Final Response` $\rightarrow$ `TerminalUI`.