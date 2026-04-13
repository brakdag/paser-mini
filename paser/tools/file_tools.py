import json
import tempfile
import logging
import ast
from typing import Optional, List, Dict, Any
from pathlib import Path
from .core_tools import context
from .validation import validate_args
from .schemas import (
    ReadFileSchema, WriteFileSchema, ReadFilesSchema, ReplaceStringSchema, ReplaceStringAtLineSchema,
    RemoveFileSchema, CreateDirSchema, ReadFileWithLinesSchema, 
    CopyLinesSchema, CutLinesSchema, PasteLinesSchema
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

@validate_args(ReadFileSchema)
def read_file(path: str) -> str:
    safe_path = Path(context.get_safe_path(path))
    if not safe_path.is_file():
        raise FileNotFoundError(f'ERR: Not found: {path}')
    
    size = safe_path.stat().st_size
    if size > FILE_SIZE_LIMIT:
        raise ValueError(f'ERR: Too large: {path}')
    if is_binary_file(safe_path):
        raise ValueError(f'ERR: Binary: {path}')
    
    if size > READ_PREVIEW_LIMIT:
        content = safe_path.read_text(encoding='utf-8')
        lines = content.splitlines()
        preview = "\n".join(lines[:100])
        return f"[PREVIEW - First 100 lines of {size} bytes]\n{preview}\n\n[TRUNCATED - Use read_lines for more]"
    
    return safe_path.read_text(encoding='utf-8') or f'ERR: Empty: {path}'

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
        raise FileNotFoundError(f'ERR: Not found: {path}')

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

def update_line(path: str, line_number: int, new_content: str) -> str:
    safe_path = Path(context.get_safe_path(path))
    lines = safe_path.read_text(encoding='utf-8').splitlines(keepends=True)
    if not (1 <= line_number <= len(lines)):
        raise IndexError(f'ERR: Line {line_number} out of range')
    lines[line_number-1] = new_content + '\n'
    safe_path.write_text(''.join(lines), encoding='utf-8')
    return 'OK'

@validate_args(ReplaceStringSchema)
def replace_string(path: str, search_text: str, replace_text: str) -> str:
    safe_path = Path(context.get_safe_path(path))
    content = safe_path.read_text(encoding='utf-8')
    if search_text not in content:
        raise ValueError(f'ERR: Not found in {path}')
    safe_path.write_text(content.replace(search_text, replace_text, 1), encoding='utf-8')
    return 'OK'

@validate_args(ReplaceStringAtLineSchema)
def replace_string_at_line(path: str, line_number: int, search_text: str, replace_text: str) -> str:
    safe_path = Path(context.get_safe_path(path))
    lines = safe_path.read_text(encoding='utf-8').splitlines(keepends=True)
    if not (1 <= line_number <= len(lines)):
        raise IndexError(f'ERR: Line {line_number} out of range')
    target_line = lines[line_number-1]
    if search_text not in target_line:
        raise ValueError(f'ERR: Not found in line {line_number}')
    lines[line_number-1] = target_line.replace(search_text, replace_text)
    safe_path.write_text(''.join(lines), encoding='utf-8')
    return 'OK'

def rename_path(origen: str, destino: str) -> str:
    try:
        Path(context.get_safe_path(origen)).rename(context.get_safe_path(destino))
        return 'OK'
    except FileNotFoundError:
        raise FileNotFoundError(f'ERR: Origin not found: {origen}')

@validate_args(CreateDirSchema)
def create_dir(path: str) -> str:
    Path(context.get_safe_path(path)).mkdir(parents=True, exist_ok=True)
    return 'OK'

def search_files_pattern(pattern: str) -> str:
    root = Path(context.get_safe_path('.'))
    results = [str(p.relative_to(root)) for p in root.rglob(pattern)]
    if len(results) > MAX_LIST_RESULTS:
        return json.dumps({"results": results[:MAX_LIST_RESULTS], "total": len(results), "warning": f"Truncated to {MAX_LIST_RESULTS} items"})
    return json.dumps(results)

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
    except Exception as e:
        return json.dumps([f"ERR: Search failed: {str(e)}"])

def format_code(path: str) -> str:
    import subprocess
    subprocess.run(['black', '--', context.get_safe_path(path)], check=True)
    return 'OK'

def get_tree(path: str = '.', max_depth: Optional[int] = None, exclude_patterns: Optional[List[str]] = None) -> str:
    return 'Tree structure generated.'

@validate_args(ReadFileWithLinesSchema)
def read_file_with_lines(path: str) -> str:
    safe_path = Path(context.get_safe_path(path))
    if not safe_path.is_file():
        raise FileNotFoundError(f'ERR: Not found: {path}')
    lines = safe_path.read_text(encoding='utf-8').splitlines()
    return ''.join([f'{i+1}: {line}\n' for i, line in enumerate(lines)])

@validate_args(CopyLinesSchema)
def copy_lines(path: str, start_line: int, end_line: int) -> str:
    safe_path = Path(context.get_safe_path(path))
    lines = safe_path.read_text(encoding='utf-8').splitlines(keepends=True)
    if not (1 <= start_line <= end_line <= len(lines)):
        raise IndexError(f'ERR: Range {start_line}-{end_line} out of bounds')
    context.clipboard = ''.join(lines[start_line-1:end_line])
    return 'OK'

@validate_args(CutLinesSchema)
def cut_lines(path: str, start_line: int, end_line: int) -> str:
    safe_path = Path(context.get_safe_path(path))
    lines = safe_path.read_text(encoding='utf-8').splitlines(keepends=True)
    if not (1 <= start_line <= end_line <= len(lines)):
        raise IndexError(f'ERR: Range {start_line}-{end_line} out of bounds')
    context.clipboard = ''.join(lines[start_line-1:end_line])
    remaining = lines[:start_line-1] + lines[end_line:]
    safe_path.write_text(''.join(remaining), encoding='utf-8')
    return 'OK'

@validate_args(PasteLinesSchema)
def paste_lines(path: str, line_number: int) -> str:
    if not context.clipboard:
        raise ValueError('ERR: Clipboard empty')
    safe_path = Path(context.get_safe_path(path))
    content = context.clipboard
    if content and not content.endswith('\n'):
        content += '\n'
    if not safe_path.is_file():
        safe_path.write_text(content, encoding='utf-8')
        return 'OK'
    lines = safe_path.read_text(encoding='utf-8').splitlines(keepends=True)
    if not (1 <= line_number <= len(lines) + 1):
        raise IndexError(f'ERR: Line {line_number} out of range')
    lines.insert(line_number-1, content)
    safe_path.write_text(''.join(lines), encoding='utf-8')
    return 'OK'

def manage_imports(path: str, add_imports: List[str] = [], remove_imports: List[str] = []) -> str:
    safe_path = Path(context.get_safe_path(path))
    lines = safe_path.read_text(encoding='utf-8').splitlines(keepends=True)
    source = ''.join(lines)
    try:
        ast.parse(source)
    except SyntaxError as e:
        raise ValueError(f'ERR: Syntax error: {e}')
    new_lines = [line for line in lines if not any(
        (line.strip().startswith('import ') or line.strip().startswith('from ')) and rem in line 
        for rem in remove_imports
    )]
    insertion_point = 0
    for i, line in enumerate(new_lines):
        stripped = line.strip()
        if stripped and not (stripped.startswith('import ') or stripped.startswith('from ') or stripped.startswith('"""')):
            insertion_point = i
            break
    added_count = 0
    for imp in add_imports:
        if not any(imp in line for line in new_lines):
            new_lines.insert(insertion_point, imp + '\n')
            insertion_point += 1
            added_count += 1
    safe_path.write_text(''.join(new_lines), encoding='utf-8')
    return 'OK'