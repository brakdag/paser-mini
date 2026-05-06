import os
from pathlib import Path

class ToolError(Exception):
    """Exception raised for errors in tool execution."""
    pass

class Context:
    def __init__(self):
        # Define the root as the current execution directory
        self.root = Path(os.getcwd()).resolve()

    def get_safe_path(self, path: str) -> Path:
        """Resolves the path and verifies it is within the project root."""
        try:
            p = Path(path).resolve()
            if not str(p).startswith(str(self.root)):
                raise PermissionError(f"Access denied: {path} is outside project root")
            return p
        except Exception as e:
            if isinstance(e, PermissionError): raise e
            return Path(path)

context = Context()