<!-- Navigation: See /robots.txt for the Cognitive Navigation Map -->

# Detailed Technical Architecture

This project follows a modular ReAct (Reasoning and Acting) architecture. Below is the detailed breakdown of the components:

### ⚙️ Core Engine (`src/core/`)

- **`chatManager.js`**: The central orchestrator. It manages the conversation loop and prevents infinite loops via `RepetitionDetector`.
- **`turnProcessor.js`**: Implements the ReAct loop. It coordinates between the API, the tool engine, and the UI to process a single user turn.
- **`ApiCommunicator.js`**: Handles the resilient communication with the LLM, implementing exponential backoff and error recovery.
- **`FountainAdapter.js`**: Manages the specific logic for Screenplay (Fountain) mode, including message injection and formatting.
- **`terminalUI.js`**: The UI facade. It delegates to `TerminalRenderer` for output, `TerminalInput` for input, and `SessionLogger` for persistence.
- **`TerminalRenderer.js`**: Pure rendering logic. Handles Markdown, Tables, and Fountain layouts.
- **`TerminalInput.js`**: Manages the terminal input stream and user confirmations.
- **`SessionLogger.js`**: Handles the writing of session and history logs to disk.
- **`commandHandler.js`**: Implements the internal command system (e.g., `/models`, `/s`, `/t`) to modify agent state without affecting the chat history.
- **`configManager.js`**: Handles the persistence of user preferences in `config/config.json`.

### 💠 Infrastructure (`src/infrastructure/`)

- **`gemini/adapter.js`**: The `GeminiAdapter` class abstracts the Google GenAI API, managing chat sessions, history, and model configuration.
- **`memento/`**: Implements the Cognitive Graph using SQLite for persistent, distilled memory.
- **`nvidia/`**: Hardware-specific integrations for optimized LLM execution.

### 💡 Toolbox (`src/tools/`)

- **`registry.js`**: The source of truth for available tools and the `SYSTEM_INSTRUCTION` that defines the agent's persona and protocol.
- **`fileTools.js`**: Implements secure file operations (read, write, replace, delete) restricted to the project root.
- **`searchTools.js`**: Wraps system utilities for efficient global searching.
- **`systemTools.js`**: Integrates `pyright` for static type analysis of the JS/TS codebase.
- **`instanceTools.js`**: Enables "inception" capabilities, allowing the launching of new independent `paser-mini` instances.

### ↻ Data Flow

`User Input` $\rightarrow$ `TerminalUI` $\rightarrow$ `TurnProcessor` $\rightarrow$ `ApiCommunicator` $\rightarrow$ `GeminiAdapter` $\rightarrow$ `SmartToolParser` (if tool call) $\rightarrow$ `ExecutionEngine` $\rightarrow$ `Tools` $\rightarrow$ `TurnProcessor` (loop) $\rightarrow$ `Final Response` $\rightarrow$ `TerminalUI`.
