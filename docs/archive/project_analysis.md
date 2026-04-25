# Project Analysis: Paser Mini

## Summary
Paser Mini is a minimalist autonomous agent designed for Linux/Debian environments, powered by Google's Gemini model. Its architecture focuses on the ReAct (Reasoning and Acting) pattern to execute tasks efficiently with minimal resource overhead.

## Main Components
- **Core Engine (`paser/core/`)**: Central orchestrator managing the chat cycle, tool execution, and infinite loop prevention.
- **Infrastructure (`paser/infrastructure/`)**: Abstraction layer for the Gemini API, error handling, and session persistence.
- **Toolbox (`paser/tools/`)**: Set of essential tools for file manipulation, searching, static analysis (Pyright), and delegated instance execution.

## Development Philosophy
- **Minimalism**: Removal of heavy dependencies for near-instant installation.
- **Security**: File access restricted to the project root via `get_safe_path` validation.
- **Code Quality**: Focus on PEP 8 standards, strict typing, and SOLID principles.

## Workflow
1. The user interacts through a terminal interface (`rich` + `prompt_toolkit`).
2. The `ChatManager` processes the input and, if necessary, invokes tools via the `ToolParser`.
3. Tools execute local operations and return results to the model to complete the reasoning.
4. The final response is presented to the user.

## Key Commands
- `/s`: Save snapshot.
- `/t`: View token count.
- `/models`: Configure model and temperature.

## Development Considerations
- The system maintains internal state; launching new instances is recommended to verify code changes.
- `run_instance` is used to delegate testing tasks to secondary agents.