# Plan: Implement Timeout for Pyright Analysis

## 1. Goal
Prevent the `analyze_pyright` tool from hanging the autonomous agent by implementing a strict execution timeout for the underlying `pyright` process.

## 2. Technical Analysis
- **Current Implementation**: The tool uses `subprocess.run` in `paser/tools/system_tools.py` without a `timeout` parameter. 
- **Issue**: If `pyright` encounters a complex dependency graph or an internal error that causes it to hang, the thread executing the tool will block indefinitely. Since the agent waits for the tool response to continue its ReAct loop, the entire system becomes unresponsive.
- **Impact**: High. A single hanging tool call freezes the agent's reasoning process.

## 3. Implementation Steps

### Step 1: Modify `paser/tools/system_tools.py`
- Update the `analyze_pyright` function to include a `timeout` argument in the `subprocess.run` call.
- Recommended timeout: **60 seconds** (sufficient for most project sizes while preventing indefinite hangs).
- Wrap the call in a `try...except` block to specifically catch `subprocess.TimeoutExpired`.

### Step 2: Error Handling
- When a `TimeoutExpired` exception is caught, raise a `ToolError` with a clear message: `"Pyright analysis timed out after 60 seconds."`.
- This ensures the `ChatManager` receives a valid `ERR` response, allowing the agent to reason about the failure and potentially try a different approach or inform the user.

## 4. Verification Plan

### Functional Testing
- **Normal Execution**: Run `analyze_pyright` on a standard directory to ensure it still returns results correctly.
- **Timeout Verification**: (Simulated) Temporarily set the timeout to a very low value (e.g., `0.1` seconds) to verify that the `ToolError` is correctly raised and handled by the agent.

### Static Analysis
- Run `analyze_pyright` on the modified code to ensure no new type errors were introduced.

## 5. Risk Assessment
- **False Positives**: Very large projects might legitimately take more than 60 seconds. However, for the scope of `paser-mini`, 60s is a reasonable upper bound. If this becomes an issue, the timeout could be made configurable via `config.json`.
- **Resource Leakage**: `subprocess.run` handles process termination on timeout, so no zombie processes are expected.