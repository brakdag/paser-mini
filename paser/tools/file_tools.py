import json
import tempfile
import logging
from typing import Optional, List
from pathlib import Path
from .core_tools import context, ToolError
from .validation import validate_args
from .schemas import (
    ReadFileSchema, WriteFileSchema, ReadFilesSchema, ReplaceStringSchema,
    RemoveFileSchema, CreateDirSchema, ReadFileWithLinesSchema
)

logger = logging.getLogger('tools')
FILE_SIZE_LIMIT = 5 * 1024 * 1024
MAX_LIST_RESULTS = 100
READ_PREVIEW_LIMIT = 20 * 1024

def is_binary_file(path: Path) -> bool:
    try:
        with path.open('rb') as f:
            return b'\0' in f.read(1024)
    except Exception:
        return True

def _calculate_hash(content: str) -> str:
    import hashlib
    return hashlib.sha256(content.encode('utf-8')).hexdigest()

@validate_args(ReadFileSchema)
def read_file(path: str) -> str:
    safe_path = Path(context.get_safe_path(path))
    if not safe_path.is_file():
        raise ToolError(f'Not found: {path}')
    
    size = safe_path.stat().st_size
    if size > FILE_SIZE_LIMIT:
        raise ToolError(f'Too large: {path}')
    if is_binary_file(safe_path):
        raise ToolError(f'Binary: {path}')
    
    content = safe_path.read_text(encoding='utf-8')
    file_hash = _calculate_hash(content)
    
    if size > READ_PREVIEW_LIMIT:
        lines = content.splitlines()
        preview = "\n".join(lines[:100])
        return f"--- HASH: {file_hash} ---\n[PREVIEW - First 100 lines of {size} bytes]\n{preview}\n\n[TRUNCATED - Use read_lines for more]"
    
    return f"--- HASH: {file_hash} ---\n{content}" if content else f"--- HASH: {file_hash} ---\nERR: Empty: {path}"

@validate_args(ReadFilesSchema)
def read_files(paths: List[str]) -> str:
    results = []
    for path in paths:
        try:
            content = read_file(path=path)
            results.append(f'--- {path} ---\n{content}')
        except Exception as e:
            results.append(f'--- {path} ---\n{str(e)}')
    return '\n\n'.join(results)

@validate_args(WriteFileSchema)
def write_file(path: str, contenido: str) -> str:
    safe_path = Path(context.get_safe_path(path))
    safe_path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile('w', dir=safe_path.parent, delete=False, encoding='utf-8') as tf:
        tf.write(contenido)
        temp_name = tf.name
    Path(temp_name).replace(safe_path)
    return 'OK'

@validate_args(RemoveFileSchema)
def remove_file(path: str) -> str:
    safe_path = Path(context.get_safe_path(path))
    try:
        safe_path.unlink()
        return 'OK'
    except FileNotFoundError:
        raise ToolError(f'Not found: {path}')

def list_dir(path: str = '.') -> str:
    safe_path = Path(context.get_safe_path(path))
    items = [p.name for p in safe_path.iterdir()]
    if len(items) > MAX_LIST_RESULTS:
        return json.dumps({"results": items[:MAX_LIST_RESULTS], "total": len(items), "warning": f"Truncated to {MAX_LIST_RESULTS} items"})
    return json.dumps(items)

def read_lines(path: str, inicio: int, fin: int) -> str:
    safe_path = Path(context.get_safe_path(path))
    lines = safe_path.read_text(encoding='utf-8').splitlines(keepends=True)
    return ''.join(lines[inicio-1:fin])

def read_head(path: str, cantidad_lineas: int) -> str:
    return read_lines(path, 1, cantidad_lineas)

@validate_args(ReplaceStringSchema)
def replace_string(path: str, search_text: str, replace_text: str) -> str:
    safe_path = Path(context.get_safe_path(path))
    content = safe_path.read_text(encoding='utf-8')
    if search_text not in content:
        raise ToolError(f'Not found in {path}')
    safe_path.write_text(content.replace(search_text, replace_text, 1), encoding='utf-8')
    return 'OK'

def rename_path(origen: str, destino: str) -> str:
    try:
        Path(context.get_safe_path(origen)).rename(context.get_safe_path(destino))
        return 'OK'
    except FileNotFoundError:
        raise ToolError(f'Origin not found: {origen}')

@validate_args(CreateDirSchema)
def create_dir(path: str) -> str:
    Path(context.get_safe_path(path)).mkdir(parents=True, exist_ok=True)
    return 'OK'

def search_files_pattern(pattern: str) -> str:
    try:
        root = Path(context.get_safe_path('.'))
        results = [str(p.relative_to(root)) for p in root.rglob(pattern)]
        if len(results) > MAX_LIST_RESULTS:
            return json.dumps({"results": results[:MAX_LIST_RESULTS], "total": len(results), "warning": f"Truncated to {MAX_LIST_RESULTS} items"})
        return json.dumps(results)
    except Exception as e:
        raise ToolError(f"Error searching files with pattern '{pattern}': {str(e)}")

def search_text_global(query: str) -> str:
    import subprocess
    root_path = context.get_safe_path(".")
    try:
        result = subprocess.run(
            ['grep', '-rIn', '--', query, root_path], 
            capture_output=True, 
            text=True, 
            encoding='utf-8', 
            errors='replace'
        )
        
        if result.returncode > 1:
            raise ToolError(f"Grep failed with return code {result.returncode}: {result.stderr}")
            
        if not result.stdout:
            return json.dumps([])
            
        parsed_results = []
        for line in result.stdout.splitlines():
            parts = line.split(':', 2)
            if len(parts) == 3:
                file_path, line_num, text = parts
                parsed_results.append({
                    "file": str(Path(file_path).absolute()),
                    "line": int(line_num),
                    "text": text.strip()
                })
        
        if len(parsed_results) > MAX_LIST_RESULTS:
            return json.dumps({"results": parsed_results[:MAX_LIST_RESULTS], "total": len(parsed_results), "warning": f"Truncated to {MAX_LIST_RESULTS} items"})
        return json.dumps(parsed_results)
    except ToolError:
        raise
    except Exception as e:
        raise ToolError(f"Search failed: {str(e)}")

def get_tree(path: str = '.', max_depth: Optional[int] = None, exclude_patterns: Optional[List[str]] = None) -> str:
    safe_root = Path(context.get_safe_path(path))
    if not safe_root.exists():
        raise ToolError(f'Path not found: {path}')
    
    exclude_patterns = exclude_patterns or []
    
    def _build_tree(current_dir: Path, depth: int, prefix: str = "") -> str:
        if max_depth is not None and depth > max_depth:
            return ""
        
        lines = []
        try:
            # Sort entries: directories first, then files
            entries = sorted(list(current_dir.iterdir()), key=lambda x: (x.is_file(), x.name.lower()))
        except OSError as e:
            return f"{prefix}└── [Error: {e.strerror or str(e)}]"

        # Filter excluded patterns
        entries = [e for e in entries if not any(p in e.name for p in exclude_patterns)]
        
        for i, entry in enumerate(entries):
            is_last = (i == len(entries) - 1)
            connector = "└─ " if is_last else "├─ "
            
            lines.append(f"{prefix}{connector}{entry.name}")
            
            if entry.is_dir():
                new_prefix = prefix + ("    " if is_last else "│   ")
                subtree = _build_tree(entry, depth + 1, new_prefix)
                if subtree:
                    lines.append(subtree)
        
        return "\n".join(lines)

    tree_content = _build_tree(safe_root, 0)
    return f"{safe_root.name}/\n{tree_content}"

@validate_args(ReadFileWithLinesSchema)
def read_file_with_lines(path: str) -> str:
    safe_path = Path(context.get_safe_path(path))
    if not safe_path.is_file():
        raise ToolError(f'Not found: {path}')
    lines = safe_path.read_text(encoding='utf-8').splitlines()
    return ''.join([f'{i+1}: {line}\n' for i, line in enumerate(lines)])
