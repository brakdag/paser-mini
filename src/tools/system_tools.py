import subprocess
import os
import logging
from . import context, ToolError

logger = logging.getLogger("tools")

def analyzePyright(path: str = ".") -> str:
    """Analiza código usando pyright y devuelve errores si existen."""
    pyright_path = os.path.join(context.root, "venv", "bin", "pyright")
    if not os.path.exists(pyright_path):
        pyright_path = "pyright"
        
    safe_path = context.get_safe_path(path)
    try:
        result = subprocess.run([pyright_path, "--outputjson", safe_path], capture_output=True, text=True, timeout=60)
    except subprocess.TimeoutExpired:
        raise ToolError("Pyright analysis timed out after 60 seconds.")

    if result.returncode == 0:
        return "No se encontraron errores de tipo."
    return result.stdout
