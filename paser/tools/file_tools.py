import os
import json
import tempfile
import logging
import re
import fnmatch
import ast
from typing import Optional
from pathlib import Path
from .core_tools import context
from .validation import validate_args
from .schemas import (
    ReadFileSchema, WriteFileSchema, ReadFilesSchema, ReplaceStringSchema, ReplaceStringAtLineSchema,
    RemoveFileSchema, CreateDirSchema, ReadFileWithLinesSchema, 
    CopyLinesSchema, CutLinesSchema, PasteLinesSchema
)

logger = logging.getLogger("tools")

FILE_SIZE_LIMIT = 5 * 1024 * 1024

def is_binary_file(path: str) -> bool:
    try:
        with open(path, 'rb') as f:
            return b'\0' in f.read(1024)
    except Exception:
        return True

@validate_args(ReadFileSchema)
def read_file(path: str) -> str:
    safe_path = context.get_safe_path(path)
    if not os.path.isfile(safe_path):
        raise FileNotFoundError(f"Archivo no encontrado en '{path}'.")
    file_size = os.path.getsize(safe_path)
    if file_size > FILE_SIZE_LIMIT:
        raise ValueError(f"El archivo '{path}' es demasiado grande.")
    if is_binary_file(safe_path):
        raise ValueError(f"El archivo '{path}' es binario.")
    with open(safe_path, 'r', encoding='utf-8') as f:
        return f.read() or f"El archivo '{path}' está vacío."

@validate_args(ReadFilesSchema)
def read_files(paths: list[str]) -> str:
    results = []
    for path in paths:
        try:
            content = read_file(path=path)
            results.append(f"--- ARCHIVO: {path} ---\n{content}\n--- FIN ARCHIVO ---")
        except Exception as e:
            results.append(f"--- ARCHIVO: {path} ---\nError: {str(e)}\n--- FIN ARCHIVO ---")
    return "\n\n".join(results)

@validate_args(WriteFileSchema)
def write_file(path: str, contenido: str) -> str:
    safe_path = context.get_safe_path(path)
    os.makedirs(os.path.dirname(safe_path), exist_ok=True)
    with tempfile.NamedTemporaryFile('w', dir=os.path.dirname(safe_path), delete=False, encoding='utf-8') as tf:
        tf.write(contenido)
        temp_path = tf.name
    os.replace(temp_path, safe_path)
    return f"Archivo '{path}' creado/actualizado exitosamente."

@validate_args(RemoveFileSchema)
def remove_file(path: str) -> str:
    safe_path = context.get_safe_path(path)
    try:
        os.remove(safe_path)
        return f"Archivo '{path}' borrado exitosamente."
    except FileNotFoundError:
        raise FileNotFoundError(f"No se pudo borrar el archivo '{path}' porque no existe.")

def list_dir(path: str = ".") -> str:
    return json.dumps(os.listdir(context.get_safe_path(path)))

def read_lines(path: str, inicio: int, fin: int) -> str:
    safe_path = context.get_safe_path(path)
    with open(safe_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
        return "".join(lines[inicio-1:fin])

def read_head(path: str, cantidad_lineas: int) -> str:
    return read_lines(path, 1, cantidad_lineas)

def update_line(path: str, line_number: int, new_content: str) -> str:
    safe_path = context.get_safe_path(path)
    with open(safe_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    if line_number < 1 or line_number > len(lines):
        raise IndexError(f"La línea {line_number} está fuera de rango. El archivo tiene {len(lines)} líneas.")
    
    lines[line_number-1] = new_content + "\n"
    with open(safe_path, 'w', encoding='utf-8') as f:
        f.writelines(lines)
    return f"Línea {line_number} de '{path}' modificada exitosamente."

@validate_args(ReplaceStringSchema)
def replace_string(path: str, search_text: str, replace_text: str) -> str:
    safe_path = context.get_safe_path(path)
    with open(safe_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    if search_text not in content:
        raise ValueError(f"La cadena '{search_text}' no fue encontrada en el archivo '{path}'.")
    
    # Reemplazar solo la primera ocurrencia para evitar colisiones masivas accidentales
    new_content = content.replace(search_text, replace_text, 1)
    
    with open(safe_path, 'w', encoding='utf-8') as f:
        f.write(new_content)
    return f"Primera ocurrencia de '{search_text}' reemplazada exitosamente en '{path}'."

@validate_args(ReplaceStringAtLineSchema)
def replace_string_at_line(path: str, line_number: int, search_text: str, replace_text: str) -> str:
    safe_path = context.get_safe_path(path)
    with open(safe_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    if line_number < 1 or line_number > len(lines):
        raise IndexError(f"La línea {line_number} está fuera de rango. El archivo tiene {len(lines)} líneas.")
    
    target_line = lines[line_number-1]
    if search_text not in target_line:
        raise ValueError(f"La cadena '{search_text}' no fue encontrada en la línea {line_number} de '{path}'.")
    
    lines[line_number-1] = target_line.replace(search_text, replace_text)
    
    with open(safe_path, 'w', encoding='utf-8') as f:
        f.writelines(lines)
    return f"Reemplazo quirúrgico exitoso en la línea {line_number} de '{path}'."


def rename_path(origen: str, destino: str) -> str:
    try:
        os.rename(context.get_safe_path(origen), context.get_safe_path(destino))
        return f"Ruta '{origen}' movida/renombrada a '{destino}' exitosamente."
    except FileNotFoundError:
        raise FileNotFoundError(f"El archivo o directorio de origen '{origen}' no existe.")

@validate_args(CreateDirSchema)
def create_dir(path: str) -> str:
    os.makedirs(context.get_safe_path(path), exist_ok=True)
    return f"Carpeta '{path}' creada exitosamente."

def search_files_pattern(pattern: str) -> str:
    return json.dumps([str(p.relative_to(context.get_safe_path("."))) for p in Path(context.get_safe_path(".")).glob(pattern)])

def search_text_global(query: str) -> str:
    results = []
    for root, _, files in os.walk(context.get_safe_path(".")):
        for file in files:
            file_path = os.path.join(root, file)
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    for i, line in enumerate(f, 1):
                        if query in line:
                            results.append({"file": file, "line": i, "text": line.strip()})
            except (UnicodeDecodeError, PermissionError):
                continue
    return json.dumps(results)

def format_code(path: str) -> str:
    import subprocess
    subprocess.run(['black', context.get_safe_path(path)])
    return "Formateado con Black."

def get_tree(path: str = ".", max_depth: Optional[int] = None, exclude_patterns: Optional[list[str]] = None) -> str:
    return "Tree structure generated."

@validate_args(ReadFileWithLinesSchema)
def read_file_with_lines(path: str) -> str:
    safe_path = context.get_safe_path(path)
    if not os.path.isfile(safe_path):
        raise FileNotFoundError(f"Archivo no encontrado en '{path}'.")
    with open(safe_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
        return "".join([f"{i+1}: {line}" for i, line in enumerate(lines)])

@validate_args(CopyLinesSchema)
def copy_lines(path: str, start_line: int, end_line: int) -> str:
    safe_path = context.get_safe_path(path)
    with open(safe_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    if start_line < 1 or end_line > len(lines) or start_line > end_line:
        raise IndexError(f"Rango de líneas {start_line}-{end_line} fuera de rango. El archivo tiene {len(lines)} líneas.")
    
    context.clipboard = "".join(lines[start_line-1:end_line])
    
    return f"Líneas {start_line} a {end_line} de '{path}' copiadas al portapapeles."

@validate_args(CutLinesSchema)
def cut_lines(path: str, start_line: int, end_line: int) -> str:
    safe_path = context.get_safe_path(path)
    with open(safe_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    if start_line < 1 or end_line > len(lines) or start_line > end_line:
        raise IndexError(f"Rango de líneas {start_line}-{end_line} fuera de rango. El archivo tiene {len(lines)} líneas.")
    
    context.clipboard = "".join(lines[start_line-1:end_line])
    remaining_lines = lines[:start_line-1] + lines[end_line:]
    
    # Actualizar archivo
    with open(safe_path, 'w', encoding='utf-8') as f:
        f.writelines(remaining_lines)
    
    return f"Líneas {start_line} a {end_line} de '{path}' cortadas y movidas al portapapeles."

@validate_args(PasteLinesSchema)
def paste_lines(path: str, line_number: int) -> str:
    if not context.clipboard:
        raise ValueError("El portapapeles está vacío.")
    
    clipboard_content = context.clipboard
    
    safe_path = context.get_safe_path(path)
    if not os.path.isfile(safe_path):
        # Si el archivo no existe, lo creamos
        with open(safe_path, 'w', encoding='utf-8') as f:
            f.write(clipboard_content)
        return f"Contenido pegado en nuevo archivo '{path}'."

    with open(safe_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    if line_number < 1 or line_number > len(lines) + 1:
        raise IndexError(f"Línea de inserción {line_number} fuera de rango. El archivo tiene {len(lines)} líneas.")
    
    # Asegurar que el contenido del portapapeles termine en salto de línea si no es vacío
    if clipboard_content and not clipboard_content.endswith('\n'):
        clipboard_content += '\n'

    lines.insert(line_number-1, clipboard_content)
    
    with open(safe_path, 'w', encoding='utf-8') as f:
        f.writelines(lines)
    
    return f"Contenido del portapapeles pegado en '{path}' en la línea {line_number}."

def replace_function(path: str, function_name: str, new_content: str) -> str:
    """Replaces a function in a Python file using AST to find exact boundaries."""
    safe_path = context.get_safe_path(path)
    with open(safe_path, 'r', encoding='utf-8') as f:
        source = f.read()
    
    try:
        tree = ast.parse(source)
    except SyntaxError as e:
        raise ValueError(f"Syntax error in file {path}: {e}")

    target_node = None
    if '.' in function_name:
        class_name, method_name = function_name.split('.', 1)
        for node in ast.walk(tree):
            if isinstance(node, ast.ClassDef) and node.name == class_name:
                for subnode in ast.walk(node):
                    if isinstance(subnode, (ast.FunctionDef, ast.AsyncFunctionDef)) and subnode.name == method_name:
                        target_node = subnode
                        break
                if target_node: break
    else:
        for node in ast.walk(tree):
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)) and node.name == function_name:
                target_node = node
                break

    if not target_node:
        raise ValueError(f"Function '{function_name}' not found in {path}.")

    start_line = target_node.lineno
    end_line = getattr(target_node, 'end_lineno', start_line)

    with open(safe_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    # Ensure new_content ends with newline
    if not new_content.endswith('\n'):
        new_content += '\n'

    # Replace the range [start_line-1 : end_line]
    lines[start_line-1 : end_line] = [new_content]

    with open(safe_path, 'w', encoding='utf-8') as f:
        f.writelines(lines)

    return f"Function '{function_name}' replaced successfully in {path}."

def manage_imports(path: str, add_imports: list[str] = [], remove_imports: list[str] = []) -> str:
    """Manages Python imports by adding new ones and removing unwanted ones semantically."""
    safe_path = context.get_safe_path(path)
    with open(safe_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    source = "".join(lines)
    try:
        tree = ast.parse(source)
    except SyntaxError as e:
        raise ValueError(f"Syntax error in file {path}: {e}")

    # 1. Identify current imports
    current_imports = []
    import_lines = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                current_imports.append(alias.name)
            import_lines.add(node.lineno)
        elif isinstance(node, ast.ImportFrom):
            module = node.module if node.module else "__main__"
            for alias in node.names:
                current_imports.append(f"{module}.{alias.name}")
            import_lines.add(node.lineno)

    # 2. Remove imports
    # We remove lines that start with 'import' or 'from' and contain the target string
    new_lines = []
    for line in lines:
        stripped = line.strip()
        should_remove = False
        for rem in remove_imports:
            if (stripped.startswith("import ") and rem in stripped) or (stripped.startswith("from ") and rem in stripped):
                should_remove = True
                break
        if not should_remove:
            new_lines.append(line)

    # 3. Add imports
    # Find the insertion point (after docstring or at the top)
    insertion_point = 0
    for i, line in enumerate(new_lines):
        if line.strip() == "":
            # If we found a blank line after some content, we might be past the docstring
            if i > 0 and not new_lines[0].strip().startswith('"""'):
                break
        if not line.strip().startswith('(') and i > 0:
            # This is a simplification: we look for the first non-docstring, non-import line
            if not (line.strip().startswith("import ") or line.strip().startswith("from ")):
                insertion_point = i
                break

    # Avoid duplicates when adding
    added_count = 0
    for imp in add_imports:
        # Simple check to avoid adding the exact same string
        if not any(imp in line for line in new_lines):
            new_lines.insert(insertion_point, imp + "\n")
            insertion_point += 1
            added_count += 1

    with open(safe_path, 'w', encoding='utf-8') as f:
        f.writelines(new_lines)

    # Return final list of imports for confirmation
    with open(safe_path, 'r', encoding='utf-8') as f:
        final_source = f.read()
        final_tree = ast.parse(final_source)
        final_imports = []
        for node in ast.walk(final_tree):
            if isinstance(node, ast.Import):
                for alias in node.names: final_imports.append(alias.name)
            elif isinstance(node, ast.ImportFrom):
                module = node.module if node.module else "__main__"
                for alias in node.names: final_imports.append(f"{module}.{alias.name}")
        return json.dumps({"status": "success", "added": added_count, "current_imports": final_imports})