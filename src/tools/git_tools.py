import subprocess
import re
from .core_tools import ToolError

def git_diff() -> str:
    try:
        result = subprocess.run(["git", "diff"], capture_output=True, text=True, check=True)
        return result.stdout if result.stdout else "No hay cambios."
    except subprocess.CalledProcessError as e:
        raise ToolError(f"Git diff error: {e.stderr}")

def get_current_repo() -> str:
    try:
        result = subprocess.run(["git", "remote", "get-url", "origin"], capture_output=True, text=True, check=True)
        url = result.stdout.strip()
        match = re.search(r"[:/]([^/]+/[^/]+?)(?:\.git)?$", url)
        return match.group(1) if match else ""
    except Exception:
        return ""

def revert_file(path: str) -> str:
    """Reverts changes to a file using git restore."""
    try:
        subprocess.run(["git", "restore", "--", path], check=True, capture_output=True, text=True)
        return f"File '{path}' successfully reverted."
    except subprocess.CalledProcessError as e:
        raise ToolError(f"Error reverting file '{path}': {e.stderr}")
