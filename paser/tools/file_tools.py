import json
import tempfile
import logging
from typing import Optional, List
from pathlib import Path
from . import context, ToolError

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

def read_file(path: str) -> str:
    safe_path = context.get_safe_path(path)
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

def write_file(path: str, contenido: str) -> str:
    safe_path = context.get_safe_path(path)
    safe_path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile('w', dir=safe_path.parent, delete=False, encoding='utf-8') as tf:
        tf.write(contenido)
        temp_name = tf.name
    Path(temp_name).replace(safe_path)
    return 'OK'

def remove_file(path: str) -> str:
    safe_path = context.get_safe_path(path)
    try:
        safe_path.unlink()
        return 'OK'
    except FileNotFoundError:
        raise ToolError(f'Not found: {path}')

def list_dir(path: str = '.') -> str:
    safe_path = context.get_safe_path(path)
    items = [p.name for p in safe_path.iterdir()]
    if len(items) > MAX_LIST_RESULTS:
        return json.dumps({"results": items[:MAX_LIST_RESULTS], "total": len(items), "warning": f"Truncated to {MAX_LIST_RESULTS} items"})
    return json.dumps(items)

def replace_string(path: str, search_text: str, replace_text: str) -> str:
    safe_path = context.get_safe_path(path)
    content = safe_path.read_text(encoding='utf-8')
    if search_text not in content:
        raise ToolError(f'Not found in {path}')
    safe_path.write_text(content.replace(search_text, replace_text, 1), encoding='utf-8')
    return 'OK'

def rename_path(origen: str, destino: str) -> str:
    try:
        context.get_safe_path(origen).rename(context.get_safe_path(destino))
        return 'OK'
    except FileNotFoundError:
        raise ToolError(f'Origin not found: {origen}')

def create_dir(path: str) -> str:
    context.get_safe_path(path).mkdir(parents=True, exist_ok=True)
    return 'OK'

def search_files_pattern(pattern: str) -> str:
    try:
        root = context.get_safe_path('.')
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
