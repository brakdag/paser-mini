import ast
import os
import sys
import json
import argparse

class CodeNavigator:
    def __init__(self, root_dir="."):
        self.root_dir = root_dir

    def _get_python_files(self):
        python_files = []
        for root, _, files in os.walk(self.root_dir):
            for file in files:
                if file.endswith(".py"):
                    python_files.append(os.path.join(root, file))
        return python_files

    def list_symbols(self, file_path):
        """Lists all classes and functions defined in a file."""
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                tree = ast.parse(f.read())
            
            symbols = []
            for node in ast.walk(tree):
                if isinstance(node, ast.FunctionDef):
                    symbols.append({"name": node.name, "type": "function", "line": node.lineno})
                elif isinstance(node, ast.ClassDef):
                    symbols.append({"name": node.name, "type": "class", "line": node.lineno})
                elif isinstance(node, ast.Assign):
                    for target in node.targets:
                        if isinstance(target, ast.Name):
                            symbols.append({"name": target.id, "type": "variable", "line": node.lineno})
            
            return symbols
        except Exception as e:
            return {"error": str(e)}

    def get_definition(self, symbol_name, file_path=None):
        """Finds the definition of a symbol. If file_path is None, searches the project."""
        files_to_search = [file_path] if file_path else self._get_python_files()
        
        for path in files_to_search:
            if not path or not os.path.exists(path):
                continue
            try:
                with open(path, "r", encoding="utf-8") as f:
                    tree = ast.parse(f.read())
                
                for node in ast.walk(tree):
                    if isinstance(node, (ast.FunctionDef, ast.ClassDef)) and node.name == symbol_name:
                        return {"path": path, "line": node.lineno, "column": node.col_offset}
                    if isinstance(node, ast.Assign):
                        for target in node.targets:
                            if isinstance(target, ast.Name) and target.id == symbol_name:
                                return {"path": path, "line": node.lineno, "column": target.col_offset}
            except Exception:
                continue
        
        return {"error": f"Symbol '{symbol_name}' not found."}

    def get_references(self, symbol_name, file_path=None):
        """Finds all references to a symbol."""
        files_to_search = [file_path] if file_path else self._get_python_files()
        references = []

        for path in files_to_search:
            if not path or not os.path.exists(path):
                continue
            try:
                with open(path, "r", encoding="utf-8") as f:
                    tree = ast.parse(f.read())
                
                for node in ast.walk(tree):
                    if isinstance(node, ast.Name) and node.id == symbol_name:
                        references.append({"path": path, "line": node.lineno, "column": node.col_offset})
            except Exception:
                continue
        
        return references

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="AI Code Navigator Tool")
    parser.add_argument("--define", type=str, help="Symbol to find definition for")
    parser.add_argument("--refs", type=str, help="Symbol to find references for")
    parser.add_argument("--symbols", type=str, help="File to list symbols from")
    parser.add_argument("--file", type=str, help="Specific file to target (optional)")

    args = parser.parse_args()
    nav = CodeNavigator()

    result = None
    if args.define:
        result = nav.get_definition(args.define, args.file)
    elif args.refs:
        result = nav.get_references(args.refs, args.file)
    elif args.symbols:
        result = nav.list_symbols(args.symbols)
    else:
        result = {"error": "No action specified. Use --define, --refs, or --symbols."}

    print(json.dumps(result, indent=2))