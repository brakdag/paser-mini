# TODO List - Paser

## 🐛 Bugs
- [x] **Interface Bug in `read_files` Tool**
    - **Issue:** The tool reports that the `paths` parameter must be a list even when a list is provided. This indicates a type-checking failure in the tool's implementation or its bridge to the agent.
    - **Goal:** Fix the parameter validation in `file_tools.py` to correctly handle list inputs.
- [x] **False Positive Error Detection in Executor**
    - **Issue:** The `AutonomousExecutor` marks a tool call as failed if the result string contains words like "Error", "failed", or "invalid". This causes false positives when reading source code that contains these words.
    - **Plan:** 
        1. Modify `AutonomousExecutor` to rely on exceptions for error detection instead of string matching.
        2. Update tool return types to be more structured (e.g., using a `ToolResult` class or dictionary with a status flag).
        3. Implement granular exception handling to differentiate between tool-level errors and system-level crashes.

## 🚀 Improvements
- [ ] Implement `asyncio` for non-blocking API and tool calls.
- [ ] Integrate Pydantic for tool argument validation.
- [ ] Implement structured logging for agent reasoning traces.
- [x] **Implement `setTimeOut` Tool**
- [x] **Refactor Timer to Internal Event Queue**
    - **Status:** Completed. Implemented via `EventManager` global instance and a daemon monitoring thread in `ChatManager`.