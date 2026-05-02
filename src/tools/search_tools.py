import subprocess
import shlex
import json
from pathlib import Path
from . import context, ToolError

def search_files_pattern(pattern: str) -> str:
    root_path = context.get_safe_path('.')
    try:
        # Use find with pipe to head for early termination (SIGPIPE)
        cmd = f"find {shlex.quote(str(root_path))} -path '*/.*' -prune -o -name {shlex.quote(pattern)} -print | head -n 10"
        try:
            result = subprocess.run(cmd, shell=True, capture_output=True, text=True, encoding='utf-8', timeout=80)
        except subprocess.TimeoutExpired:
            raise ToolError("Search operation timed out after 80 seconds.")
        
        if result.returncode != 0 and result.returncode != 1:
            raise ToolError(f"Find error: {result.stderr}")
        
        paths = result.stdout.splitlines()
        results = [str(Path(p).relative_to(root_path)) for p in paths if p]
        return json.dumps(results)
    except Exception as e:
        raise ToolError(f"Search error: {str(e)}")

def search_text_global(query: str) -> str:
    root_path = context.get_safe_path(".")
    try:
        # Use pipe to head -n 10 for extreme efficiency
        cmd = f"grep -rIn --exclude-dir='.*' -- {shlex.quote(query)} {shlex.quote(str(root_path))} | head -n 10"
        try:
            result = subprocess.run(
                cmd, 
                shell=True, 
                capture_output=True, 
                text=True, 
                encoding='utf-8', 
                errors='replace',
                timeout=80
            )
        except subprocess.TimeoutExpired:
            raise ToolError("Search operation timed out after 80 seconds.")
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
