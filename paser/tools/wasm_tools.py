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
        self.wasm_path = "assets/python.wasm"
        self.wasm_enabled = False
        self._check_wasm_availability()

    def _check_wasm_availability(self):
        """
        Checks if the wasmer CLI is installed and the python.wasm binary exists.
        """
        try:
            # Check if wasmer CLI is available
            subprocess.run(["wasmer", "--version"], capture_output=True, check=True)
            # Check if the binary exists
            if os.path.exists(self.wasm_path):
                self.wasm_enabled = True
                logger.info("WASM Python runtime (Wasmer CLI) is available.")
            else:
                logger.warning(f"python.wasm not found at {self.wasm_path}. Using fallback.")
        except (subprocess.CalledProcessError, FileNotFoundError):
            logger.warning("Wasmer CLI not found in PATH. Using restricted Python fallback.")

    def execute(self, code: str) -> str:
        if self.wasm_enabled:
            return self._execute_wasm(code)
        return self._execute_restricted(code)

    def _execute_wasm(self, code: str) -> str:
        """
        Executes Python code using the wasmer CLI and python.wasm binary.
        """
        # Create a temporary file for the Python code
        with tempfile.NamedTemporaryFile(suffix=".py", delete=False, mode="w") as tf:
            tf.write(code)
            temp_file_path = tf.name

        try:
            # We run: wasmer run assets/python.wasm -- <script_path>
            # We use the absolute path to ensure wasmer finds it
            abs_wasm_path = os.path.abspath(self.wasm_path)
            abs_script_path = os.path.abspath(temp_file_path)

            result = subprocess.run(
                ["wasmer", "run", abs_wasm_path, "--", abs_script_path],
                capture_output=True,
                text=True,
                timeout=30 # Prevent infinite loops
            )

            if result.returncode != 0:
                return f"Execution Error (Exit Code {result.returncode}):\n{result.stderr}"
            
            output = result.stdout
            return output if output else "Code executed successfully (no output)."

        except subprocess.TimeoutExpired:
            return "Error: Execution timed out after 30 seconds."
        except Exception as e:
            return f"WASM Runtime Error: {str(e)}"
        finally:
            # Clean up the temporary file
            if os.path.exists(temp_file_path):
                os.remove(temp_file_path)

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
