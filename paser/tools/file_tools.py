import json
import tempfile
import shlex
import itertools
import hashlib
from pathlib import Path
from . import context, ToolError
FILE_SIZE_LIMIT = 1 * 1024 * 1024
READ_CACHE = set()
MAX_LIST_RESULTS = 100


def is_binary_file(path: Path) -> bool:
    try:
        with path.open('rb') as f:
            return b'\0' in f.read(1024)
    except Exception:
        return True


def read_file(path: str) -> str:
    safe_path = context.get_safe_path(path)
    if not safe_path.is_file():
        raise ToolError('Not found')
    
    if safe_path.stat().st_size > FILE_SIZE_LIMIT:
        raise ToolError('Too large')
    if is_binary_file(safe_path):
        raise ToolError('Binary file')
    
    content = safe_path.read_text(encoding='utf-8')
    if not content:
        return ""

    file_hash = hashlib.sha256(content.encode('utf-8')).hexdigest()
    if file_hash in READ_CACHE:
        raise ToolError("No changes since last read")
    
    READ_CACHE.add(file_hash)
    return content

def write_file(path: str, contenido: str) -> str:
    try:
        safe_path = context.get_safe_path(path)
        safe_path.parent.mkdir(parents=True, exist_ok=True)
        with tempfile.NamedTemporaryFile('w', dir=safe_path.parent, delete=False, encoding='utf-8') as tf:
            tf.write(contenido)
            temp_name = tf.name
        Path(temp_name).replace(safe_path)
        return 'OK'
    except OSError as e:
        raise ToolError(f"Write error: {e.strerror}")

def remove_file(path: str) -> str:
    safe_path = context.get_safe_path(path)
    try:
        safe_path.unlink()
        return 'OK'
    except FileNotFoundError:
        raise ToolError('Not found')
    except OSError as e:
        raise ToolError(f"Remove error: {e.strerror}")

def list_dir(path: str = '.') -> str:
    try:
        safe_path = context.get_safe_path(path)
        # Use generator expression with islice to stop iterating immediately
        items = list(itertools.islice((p.name for p in safe_path.iterdir()), MAX_LIST_RESULTS))
        return json.dumps(items)
    except OSError as e:
        raise ToolError(f"Access error: {e.strerror}")

def replace_string(path: str, search_text: str, replace_text: str) -> str:
    try:
        safe_path = context.get_safe_path(path)
        content = safe_path.read_text(encoding='utf-8')
        count = content.count(search_text)
        if count == 0:
            raise ToolError('Not found')
        if count > 1:
            raise ToolError(f'Ambiguous: {count} matches')
        safe_path.write_text(content.replace(search_text, replace_text), encoding='utf-8')
        return 'OK'
    except OSError as e:
        raise ToolError(f"Modify error: {e.strerror}")

def rename_path(origen: str, destino: str) -> str:
    try:
        context.get_safe_path(origen).rename(context.get_safe_path(destino))
        return 'OK'
    except FileNotFoundError:
        raise ToolError('Origin not found')
    except OSError as e:
        raise ToolError(f"Rename error: {e.strerror}")

def create_dir(path: str) -> str:
    try:
        context.get_safe_path(path).mkdir(parents=True, exist_ok=True)
        return 'OK'
    except OSError as e:
        raise ToolError(f"Create error: {e.strerror}")

def search_files_pattern(pattern: str) -> str:
    import subprocess
    root_path = context.get_safe_path('.')
    try:
        # Use find with pipe to head for early termination (SIGPIPE)
        cmd = f"find {shlex.quote(str(root_path))} -name {shlex.quote(pattern)} | head -n 10"
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True, encoding='utf-8')
        
        if result.returncode != 0 and result.returncode != 1:
            raise ToolError(f"Find error: {result.stderr}")
        
        paths = result.stdout.splitlines()
        results = [str(Path(p).relative_to(root_path)) for p in paths if p]
        return json.dumps(results)
    except Exception as e:
        raise ToolError(f"Search error: {str(e)}")

def search_text_global(query: str) -> str:
    import subprocess
    root_path = context.get_safe_path(".")
    try:
        # Use pipe to head -n 10 for extreme efficiency
        cmd = f"grep -rIn -- {shlex.quote(query)} {shlex.quote(str(root_path))} | head -n 10"
        result = subprocess.run(
            cmd, 
            shell=True, 
            capture_output=True, 
            text=True, 
            encoding='utf-8', 
            errors='replace'
        )
        if result.returncode > 1:
            raise ToolError(f"Grep error: {result.stderr}")
        if not result.stdout:
            return json.dumps([])
        
        parsed_results = []
        for line in result.stdout.splitlines():
            parts = line.split(':', 2)
            if len(parts) == 3:
                file_path, line_num, text = parts
                parsed_results.append({
                    "file": str(Path(file_path).relative_to(root_path)),
                    "line": int(line_num),
                    "text": text.strip()
                })
        return json.dumps(parsed_results)
    except ToolError:
        raise
    except Exception as e:
        raise ToolError(f"Search error: {str(e)}")
