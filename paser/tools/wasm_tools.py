import sys
import io
import traceback
import logging
import os
import subprocess
import tempfile

logger = logging.getLogger("tools")

class PythonWasmInterpreter:
    """
    Interpreter for executing Python code using Wasmer WASM runtime.
    """
    def __init__(self):
        self.wasm_enabled = False
        self._check_wasm_availability()

    def _check_wasm_availability(self):
        """
        Checks if the wasmer CLI is installed.
        """
        try:
            # Check if wasmer CLI is available
            subprocess.run(["wasmer", "--version"], capture_output=True, check=True)
            self.wasm_enabled = True
            logger.info("WASM Python runtime (Wasmer CLI) is available.")
        except (subprocess.CalledProcessError, FileNotFoundError):
            logger.warning("Wasmer CLI not found in PATH. Using restricted Python fallback.")

    def execute(self, code: str) -> str:
        if self.wasm_enabled:
            return self._execute_wasm(code)
        return self._execute_restricted(code)

    def _execute_wasm(self, code: str) -> str:
        """
        Executes Python code using the wasmer CLI and the python/python package.
        """
        try:
            # Use '--' to ensure arguments are passed directly to the python binary
            result = subprocess.run(
                ["wasmer", "run", "python/python", "--", "-c", code],
                capture_output=True,
                text=True,
                timeout=30 # Prevent infinite loops
            )

            if result.returncode != 0:
                # Fallback to restricted execution if WASM fails with a file-not-found error
                # which suggests the -c flag was misinterpreted
                if "can't open file" in result.stderr:
                    logger.warning("WASM -c failed, falling back to restricted execution.")
                    return self._execute_restricted(code)
                return f"Execution Error (Exit Code {result.returncode}):\n{result.stderr}"
            
            output = result.stdout
            # Abstract the REPL prompt '>>>' as a successful execution signal
            if output and output.strip().endswith(" >>>"):
                output = output.strip()[:-4].strip()
            
            return output if output else "Code executed successfully (no output)."

        except subprocess.TimeoutExpired:
            return "Error: Execution timed out after 30 seconds."
        except Exception as e:
            return f"WASM Runtime Error: {str(e)}"

    def _execute_restricted(self, code: str) -> str:
        """
        Fallback: Executes Python code in a restricted environment.
        """
        output_buffer = io.StringIO()
        old_stdout = sys.stdout
        sys.stdout = output_buffer

        safe_globals = {
            "__builtins__": {
                "print": print,
                "range": range,
                "len": len,
                "int": int,
                "float": float,
                "str": str,
                "list": list,
                "dict": dict,
                "set": set,
                "sum": sum,
                "min": min,
                "max": max,
                "abs": abs,
                "round": round,
                "enumerate": enumerate,
                "zip": zip,
                "sorted": sorted,
                "reversed": reversed,
                "bool": bool,
                "complex": complex,
                "pow": pow,
                "divmod": divmod,
                "slice": slice,
                "type": type,
                "isinstance": isinstance,
                "issubclass": issubclass,
            },
            "__name__": "__main__",
        }

        try:
            exec(code, safe_globals)
            result = output_buffer.getvalue()
            return result if result else "Code executed successfully (no output)."
        except Exception:
            return traceback.format_exc()
        finally:
            sys.stdout = old_stdout

# Singleton instance
interpreter = PythonWasmInterpreter()

def execute_python(code: str) -> str:
    """
    Executes Python code in a secure sandbox (WASM via Wasmer or restricted environment).
    """
    logger.debug(f"Executing Python code: {code[:50]}...")
    return interpreter.execute(code)
