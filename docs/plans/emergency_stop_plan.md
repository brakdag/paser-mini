# Plan: Emergency Stop (Golpe de Puño)

## 🎯 Objective
Implement an emergency interruption mechanism that allows the user to stop the agent's autonomy in real-time using the `Esc` key, enabling immediate manual intervention before resuming execution.

## ⚙️ Technical Description

### 1. The Problem
Currently, when the agent enters the `ChatManager.execute` loop, the program is processing LLM responses and executing tools. In this state, the main thread is not waiting for user input via `prompt_toolkit`, so key presses are not processed until the agent finishes its cycle or encounters an error.

### 2. The Solution: Asynchronous Listening
To achieve a true "Emergency Stop", we will implement a keyboard listener in a separate thread or via an `asyncio` task that monitors the `Esc` key globally in the terminal.

### 3. Workflow
1. **Detection:** A listener detects the `Esc` key press.
2. **Interruption:** The `self.stop_requested = True` flag is activated in the `ChatManager`.
3. **Braking:** The `execute` loop checks `stop_requested` in each iteration. Upon detection, it stops the current tool execution (if possible) or aborts the next call.
4. **Visual Feedback:** The `TerminalUI` prints a disruptive message: `🚨 [EMERGENCY STOP] - AGENT HALTED`.
5. **Intervention:** The system immediately invokes `ui.request_input("> Manual Intervention: ")`.
6. **Resumption:** The user's message is sent to the LLM as a corrective instruction, and the agent resumes autonomy from that new state.

## 📋 Implementation Steps

- [ ] **Phase 1: Input Infrastructure**
    - Research and implement a non-blocking keyboard listener (using `pynput` or `termios` for Linux).
    - Integrate the listener into `main.py` to start upon application launch.

- [ ] **Phase 2: Core Modification (`ChatManager`)
    - Refine the `stop_requested` check within the tool loop.
    - Implement the "Manual Intervention" logic that breaks the loop and requests input.

- [ ] **Phase 3: User Interface (`TerminalUI`)
    - Create the `display_emergency_stop()` method to show the halt notice.
    - Ensure the tool spinner stops immediately when `Esc` is pressed.

- [ ] **Phase 4: Testing and Validation**
    - Test interruption during a long task (e.g., reading many files).
    - Validate that autonomy recovers correctly after intervention.

## ⚠️ Considerations
- **Dependencies:** If `pynput` is used, `pyproject.toml` must be updated.
- **Synchronization:** The listener must communicate with the `ChatManager` in a thread-safe manner.