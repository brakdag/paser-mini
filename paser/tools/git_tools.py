import subprocess
import re

def git_diff() -> str:
    """Ejecuta 'git diff' para mostrar los cambios actuales en el repositorio."""
    try:
        result = subprocess.run(["git", "diff"], capture_output=True, text=True, check=True)
        return result.stdout if result.stdout else "No hay cambios en el repositorio."
    except subprocess.CalledProcessError as e:
        return f"Error al ejecutar git diff: {e.stderr}"

def get_remote_repo() -> str:
    """Obtiene el nombre del repositorio (usuario/repo) desde el remote origin."""
    try:
        result = subprocess.run(["git", "remote", "get-url", "origin"], capture_output=True, text=True, check=True)
        url = result.stdout.strip()
        # Regex para extraer usuario/repo de git@github.com:usuario/repo.git o https://github.com/usuario/repo.git
        match = re.search(r"[:/]([^/]+/[^/]+?)(?:\.git)?$", url)
        if match:
            return match.group(1)
        raise ValueError("No se pudo extraer el nombre del repo del remote.")
    except Exception as e:
        return f"Error al obtener el repositorio: {str(e)}"
