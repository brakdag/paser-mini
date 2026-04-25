# Wasmer Sandbox Implementation for run_instance

## 1. Objective
To enhance the security and flexibility of the run_instance tool. The goal is to allow the agent to execute arbitrary Python code while strictly limiting the blast radius.

## 2. Problem Statement
- **Lack of Isolation**: Original implementation used subprocess directly, vulnerable to shell injection.
- **Rigid Execution**: Primarily designed for paser-mini, lacking flexibility for other modules.
- **No Real Sandbox**: venv provided no protection against accessing host sensitive files.

## 3. Proposed Solution

### A. Python-Only Enforcement
The tool always uses the project's virtual environment Python interpreter (venv/bin/python) as the entry point. This prevents shell injection.

### B. WebAssembly (Wasm) Integration
Introduce a sandbox=True parameter that leverages wasmer to run Python within a WebAssembly runtime for true isolation.

### C. WASI Directory Mapping
Implement directory mapping using the --mapdir flag. This maps the current project directory into the Wasm environment, allowing access to project files while remaining blind to the host filesystem.

## 4. Implementation Details

### Tool Signature
run_instance(target: str, message: str = None, args: list = None, sandbox: bool = False)

### Execution Logic
1. **Mode: sandbox=False (Standard)**
   - Executes: venv/bin/python -m <target> [args] [message]
   - Best for: General development and C-extension libraries.

2. **Mode: sandbox=True (Secure)**
   - Executes: wasmer run python --mapdir .:. -m <target> [args] [message]
   - Best for: Running untrusted code with maximum isolation.

## 5. Security Analysis

- **Blast Radius**: Limited to the current project directory.
- **System Protection**: Host OS and user files are invisible to the sandbox.
- **Recovery**: Project can be restored via git reset --hard.

## 6. Compliance
- **Language**: English
- **Location**: docs/plans/wasmer_sandbox_implementation.md