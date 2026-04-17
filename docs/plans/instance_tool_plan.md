# Implementation Plan: Instance Execution Tool (Self-Testing)

## 🎯 Objective
Implement a tool that allows the agent to launch a new instance of `paser-mini` within the same virtual environment. This will enable real-time validation of code changes, as the current agent operates on a version loaded in memory and would not detect syntax or import errors introduced in modified files until a restart.

## ⚙️ Technical Specifications

### 1. Tool Behavior
- **Name**: `run_instance`
- **Function**: Must execute the `paser-mini` binary or the `paser/main.py` script using the Python interpreter of the current virtual environment.
- **Interactivity**: The tool must yield terminal control (`stdin`, `stdout`, `stderr`) to the new process so that the human user can interact with the new instance as a REPL.
- **Termination**: Once the user closes the secondary instance (via `/q` or `exit`), control must return to the primary agent instance.

### 2. Components to Modify/Create

#### A. New Tool (`paser/tools/instance_tools.py`)
- Create a new module for instance management tools.
- Implement the `run_instance()` function using Python's `subprocess` module.
- Ensure the correct path to the virtual environment (`venv`) is used.

#### B. Tool Registry (`paser/tools/registry.py`)
- Import `run_instance` from the new module.
- Add `run_instance` to the `AVAILABLE_TOOLS` dictionary.

#### C. Tool Catalog (`paser/tools/registry_positional.json`)
- Add the tool definition (name, description, and parameters) so the LLM knows how and when to use it.

## 🚀 Execution Steps

1. **Development Phase**:
   - [ ] Create `paser/tools/instance_tools.py` with the subprocess execution logic.
   - [ ] Register the tool in `paser/tools/registry.py`.
   - [ ] Update `paser/tools/registry_positional.json`.

2. **Validation Phase**:
   - [ ] Launch the primary agent.
   - [ ] Request the agent to launch a new instance using the `run_instance` tool.
   - [ ] Verify that the new instance starts correctly and is interactive.
   - [ ] Close the secondary instance and confirm that the primary agent regains control.

3. **Stress Test Phase**:
   - [ ] Introduce a deliberate error in `paser/main.py`.
   - [ ] Attempt to launch the instance to confirm that the error is visible and reported by the system.

## ⚠️ Important Considerations
- **Event Loop Blocking**: Since `subprocess.run` is blocking, the tool must be executed in a way that does not freeze the primary agent's UI, although in this case, it is intended for the user to take full control of the terminal.
- **Paths**: Use `os.getcwd()` or the project context to locate the Python executable within `venv/bin/python`.