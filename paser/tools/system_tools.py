import subprocess
import os
import logging
from .core_tools import PROJECT_ROOT, get_safe_path

logger = logging.getLogger("tools")

def analizar_codigo_con_pyright(path: str = ".") -> str:
    """Analiza código usando pyright y devuelve errores si existen."""
    try:
        pyright_path = os.path.join(PROJECT_ROOT, "venv", "bin", "pyright")
        if not os.path.exists(pyright_path):
            pyright_path = "pyright"
            
        safe_path = get_safe_path(path)
        result = subprocess.run([pyright_path, "--outputjson", safe_path], capture_output=True, text=True)
        if result.returncode == 0:
            return "No se encontraron errores de tipo."
        return result.stdout
    except Exception as e:
        logger.error(f"Error ejecutando pyright: {e}")
        return f"Error ejecutando pyright: {e}"
