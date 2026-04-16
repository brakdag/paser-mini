# Plan: Tool Execution Monitoring & Dynamic Spinner

## 1. Objective
Implement a real-time feedback system for tool execution. The UI must notify the user when a tool starts and ends (with status), while maintaining a dynamic spinner that stays on the same line as the current task and moves down only when a new task begins, mimicking classic Linux loading sequences.

## 2. Technical Architecture

### A. UI Interface Expansion (`paser/core/ui_interface.py`)
Add the following methods to the `UserInterface` ABC to decouple the monitoring logic from the implementation:
- `start_tool_monitoring(tool_name: str)`: Signals the start of a tool execution and activates the spinner.
- `end_tool_monitoring(tool_name: str, success: bool)`: Updates the current line with the result ([OK/FAIL]) and prepares the spinner for the next task.

### B. Terminal Implementation (`paser/core/terminal_ui.py`)
Use the `rich.live` or `rich.status` module to handle the dynamic line updates:
1. **State Management**: Maintain a reference to a `rich.live.Live` object or a `rich.status.Status` instance.
2. **Line Control**: 
    - When `start_tool_monitoring` is called, print the tool name and start the spinner on the same line.
    - When `end_tool_monitoring` is called, replace the spinner/loading text with the final status (`[OK]` in green or `[FAIL]` in red) and move the cursor to the next line.
3. **Visual Style**: Ensure the spinner is positioned to the right of the tool name.

### C. Core Integration (`paser/core/chat_manager.py`)
Modify the `execute` method loop where tools are processed:
1. **Before tool call**: Call `self.ui.start_tool_monitoring(name)`.
2. **After tool call**: Call `self.ui.end_tool_monitoring(name, success=True/False)` based on the result of the execution.

## 3. Implementation Steps
1. **Step 1**: Update `UserInterface` ABC with the new monitoring methods.
2. **Step 2**: Implement the logic in `TerminalUI` using `rich`. This is the most complex part as it requires managing the console's live render area.
3. **Step 3**: Integrate the calls into the `ChatManager.execute` loop.
4. **Step 4**: Refine the visual output to ensure no extra newlines are added unless a new tool starts.

## 4. Testing Strategy
- **Sequential Tool Test**: Trigger a sequence of 3-5 tools (e.g., `list_dir` $ightarrow$ `read_file` $ightarrow$ `write_file`) and verify that the spinner moves down correctly and statuses are printed on the same line.
- **Failure Test**: Force a tool error (e.g., `read_file` on a non-existent path) to verify the `[FAIL]` status and red coloring.
- **Rapid Execution Test**: Run tools that execute very quickly to ensure the spinner doesn't flicker or break the line formatting.

## 5. Executor Role
**Senior Python UI/UX Engineer specializing in Rich and Asyncio**