import jedi
import os
import json
from .core_tools import context

class LSPNavigator:
    def __init__(self):
        pass

    def get_lsp_completions(self, filepath: str, line: int, column: int):
        """Returns LSP-like completions for a specific position in a file."""
        safe_path = context.get_safe_path(filepath)
        if not os.path.exists(safe_path):
            return {"error": f"File {filepath} not found."}

        try:
            # Jedi uses 1-based indexing for lines and columns
            script = jedi.Script(path=safe_path)
            completions = script.complete(line, column)
            
            results = []
            for c in completions:
                results.append({
                    "name": c.name,
                    "type": c.type,
                    "description": c.description,
                    "module": c.module
                })
            return results
        except ImportError:
            return {"error": "The 'jedi' library is not installed. Please run 'pip install jedi' in your terminal."}
        except Exception as e:
            return {"error": str(e)}

    def get_object_methods(self, object_name: str, filepath: str):
        """Finds the available methods/attributes for a specific object name in a file."""
        safe_path = context.get_safe_path(filepath)
        if not os.path.exists(safe_path):
            return {"error": f"File {filepath} not found."}

        try:
            with open(safe_path, 'r', encoding='utf-8') as f:
                lines = f.readlines()

            # Find the last occurrence of the object_name to get the most relevant context
            last_line = -1
            last_col = -1
            for i, line in enumerate(lines, 1):
                if object_name in line:
                    last_line = i
                    last_col = line.find(object_name) + len(object_name) + 1

            if last_line == -1:
                return {"error": f"Object '{object_name}' not found in {filepath}."}

            # Use get_lsp_completions at that position
            return self.get_lsp_completions(filepath, last_line, last_col)

        except ImportError:
            return {"error": "The 'jedi' library is not installed. Please run 'pip install jedi' in your terminal."}
        except Exception as e:
            return {"error": str(e)}

# Singleton instance
lsp_nav = LSPNavigator()