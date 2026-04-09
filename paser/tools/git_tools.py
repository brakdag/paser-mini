import subprocess
import re

def git_diff() -> str:
    try:
        result = subprocess.run(["git", "diff"], capture_output=True, text=True, check=True)
        return result.stdout if result.stdout else "No hay cambios."
    except subprocess.CalledProcessError as e:
        return f"Error: {e.stderr}"

def get_current_repo() -> str:
    try:
        result = subprocess.run(["git", "remote", "get-url", "origin"], capture_output=True, text=True, check=True)
        url = result.stdout.strip()
        match = re.search(r"[:/]([^/]+/[^/]+?)(?:\.git)?$", url)
        return match.group(1) if match else ""
    except Exception:
        return ""
