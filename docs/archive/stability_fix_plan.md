# Stability and Bug Fix Plan

## 1. Objective

This document outlines the technical plan to resolve stability vulnerabilities identified during the forensic audit, focusing on preventing application hangs, memory leaks, and API-exhausting behavioral loops.

## 2. Identified Issues & Proposed Solutions

### 2.1. Subprocess Hangs in Search Tools

- **File**: `paser/tools/search_tools.py`
- **Observed Behavior**: `subprocess.run` is called without a timeout for `find` and `grep` operations.
- **Risk**: Potential for the application to hang indefinitely if the system call blocks (e.g., due to network file systems or circular directories).
- **Technical Solution**:
  - Add `timeout=80` to all `subprocess.run` calls in `searchFilesPattern` and `searchTextGlobal`.
  - Wrap calls in a `try-except` block to handle `subprocess.TimeoutExpired` and return a clear `ToolError` to the agent.

### 2.2. Memory Leak in File Read Cache

- **File**: `paser/tools/file_tools.py`
- **Observed Behavior**: `READ_CACHE` is a `set()` that grows indefinitely as more unique files are read.
- **Risk**: Gradual memory exhaustion in long-running sessions or when processing massive codebases.
- **Technical Solution**:
  - Replace `READ_CACHE = set()` with a size-limited cache mechanism.
  - Implementation: Use `collections.deque` with a `maxlen` or a simple check to clear the set when it exceeds a threshold (e.g., 1000 entries).

## 3. Verification Plan

| Issue               | Test Case                                                            | Expected Result                                                             |
| :------------------ | :------------------------------------------------------------------- | :-------------------------------------------------------------------------- |
| **Search Hang**     | Simulate a blocked process (e.g., using a mock or a slow pipe).      | Tool returns `ERR: Timeout` after 30s instead of hanging.                   |
| **Memory Leak**     | Read 2000 unique small files in a loop.                              | `READ_CACHE` size remains capped at the defined limit.                      |
| **Behavioral Loop** | Force the agent to call a failing tool with slight argument changes. | `ChatManager` detects the repeated failure pattern and interrupts the loop. |

## 4. Execution Order

1. **Critical**: Fix `search_tools.py` timeouts.
2. **High**: Implement `ToolAttemptTracker` in `chat_manager.py`.
3. **Medium**: Implement `READ_CACHE` limit in `file_tools.py`.

