import os
from pathlib import Path

class ToolError(Exception):
    """Exception raised for errors in tool execution."""
    pass

class Context:
    def __init__(self):
        # Definimos la raíz como el directorio actual de ejecución
        self.root = Path(os.getcwd()).resolve()

    def get_safe_path(self, path: str) -> Path:
        """Resuelve la ruta y verifica que esté dentro de la raíz del proyecto."""
        try:
            p = Path(path).resolve()
            if not str(p).startswith(str(self.root)):
                raise PermissionError(f"Access denied: {path} is outside project root")
            return p
        except Exception as e:
            if isinstance(e, PermissionError): raise e
            return Path(path)

context = Context()