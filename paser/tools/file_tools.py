import json
import tempfile
import itertools
import hashlib
import difflib
import shutil
import subprocess
import sys
from collections import deque
from pathlib import Path
from . import context, ToolError

FILE_SIZE_LIMIT = 100 * 1024
READ_CACHE = deque(maxlen=1000)
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
        raise ToolError('File too large')
    if is_binary_file(safe_path):
        raise ToolError('Binary file')
    
    content = safe_path.read_text(encoding='utf-8')
    if not content:
        return ""

    file_hash = hashlib.sha256(content.encode('utf-8')).hexdigest()
    if file_hash in READ_CACHE:
        READ_CACHE.remove(file_hash)
        raise ToolError("No changes since last read")
    
    READ_CACHE.append(file_hash)
    return content

def clear_read_cache():
    """Clears the file read cache to force re-reading of files."""
    READ_CACHE.clear()

def write_file(path: str, contenido: str) -> str:
    if len(contenido.encode('utf-8')) > FILE_SIZE_LIMIT:
        raise ToolError('Content too large')
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
        try:
            shutil.rmtree(safe_path)
        except NotADirectoryError:
            safe_path.unlink()
        return 'OK'
    except FileNotFoundError:
        raise ToolError('Not found')
    except OSError as e:
        raise ToolError(f"Remove error: {e.strerror}")

def list_dir(path: str = '.') -> str:
    try:
        safe_path = context.get_safe_path(path)
        items = list(itertools.islice((p.name for p in safe_path.iterdir()), MAX_LIST_RESULTS))
        return json.dumps(items)
    except OSError as e:
        raise ToolError(f"Access error: {e.strerror}")

def replace_string(path: str, search_text: str, replace_text: str) -> str:
    if not search_text:
        raise ToolError('Search text cannot be empty')
    try:
        safe_path = context.get_safe_path(path)
        content = safe_path.read_text(encoding='utf-8')
        
        # Check if the resulting content would exceed the limit
        new_size = len(content) - len(search_text) + len(replace_text)
        if new_size > FILE_SIZE_LIMIT:
            raise ToolError('Resulting content too large')

        # Phase 1: Exact Match
        count = content.count(search_text)
        if count == 1:
            safe_path.write_text(content.replace(search_text, replace_text), encoding='utf-8')
            return 'OK'
        if count > 1:
            raise ToolError(f'Ambiguous: {count} matches')
        
        # Phase 2: Fuzzy Match (Suggestion Only)
        lines = content.splitlines()
        # Use the first line of search_text to find a close match
        search_line = search_text.splitlines()[0]
        closest = difflib.get_close_matches(search_line, lines, n=1, cutoff=0.6)
        
        if closest:
            suggestion = closest[0].strip()
            raise ToolError(f"Exact text not found. NO replacement performed. Did you mean: '{suggestion}'?")
        
        raise ToolError('Not found')
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

def copy_file(origen: str, destino: str) -> str:
    try:
        src = context.get_safe_path(origen)
        dst = context.get_safe_path(destino)
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dst)
        return 'OK'
    except FileNotFoundError:
        raise ToolError('Origin not found')
    except OSError as e:
        raise ToolError(f"Copy error: {e.strerror}")

def get_tree() -> str:
    try:
        result = subprocess.run(
            ["git", "ls-files"],
            capture_output=True,
            text=True,
            check=True
        )
        return result.stdout
    except (subprocess.CalledProcessError, FileNotFoundError) as e:
        raise ToolError(f"Git error: {str(e)}")

def git_diff(path: str) -> str:
    try:
        safe_path = context.get_safe_path(path)
        result = subprocess.run(
            ["git", "diff", str(safe_path)],
            capture_output=True,
            text=True,
            check=True
        )
        return result.stdout if result.stdout else "No changes found."
    except subprocess.CalledProcessError as e:
        raise ToolError(f"Git diff error: {e.stderr}")
    except FileNotFoundError:
        raise ToolError("Git not found")
    except Exception as e:
        raise ToolError(f"Unexpected error: {str(e)}")

def restore_file(path: str) -> str:
    try:
        safe_path = context.get_safe_path(path)
        subprocess.run(
            ["git", "restore", str(safe_path)],
            capture_output=True,
            text=True,
            check=True
        )
        return 'OK'
    except subprocess.CalledProcessError as e:
        raise ToolError(f"Git restore error: {e.stderr}")
    except FileNotFoundError:
        raise ToolError("Git not found")
    except Exception as e:
        raise ToolError(f"Unexpected error: {str(e)}")

def code_formatter(path: str) -> str:
    try:
        safe_path = context.get_safe_path(path)
        if not safe_path.is_file():
            raise ToolError('File not found')
        
        # Using black via the current python executable to ensure it's found in the venv
        result = subprocess.run(
            [sys.executable, "-m", "black", str(safe_path)],
            capture_output=True,
            text=True,
            check=True
        )
        return 'OK'
    except subprocess.CalledProcessError as e:
        raise ToolError(f"Formatting error: {e.stderr}")
    except FileNotFoundError:
        raise ToolError("Black formatter not found")
    except Exception as e:
        raise ToolError(f"Unexpected error: {str(e)}")
