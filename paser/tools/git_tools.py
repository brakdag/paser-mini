import subprocess

def git_diff() -> str:
    """Ejecuta 'git diff' para mostrar los cambios actuales en el repositorio."""
    try:
        result = subprocess.run(["git", "diff"], capture_output=True, text=True, check=True)
        return result.stdout if result.stdout else "No hay cambios en el repositorio."
    except subprocess.CalledProcessError as e:
        return f"Error al ejecutar git diff: {e.stderr}"
