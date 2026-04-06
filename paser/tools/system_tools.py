import subprocess
import os
import logging
from .core_tools import context

logger = logging.getLogger("tools")

def analyze_pyright(path: str = ".") -> str:
    """Analiza código usando pyright y devuelve errores si existen."""
    try:
        pyright_path = os.path.join(context.root, "venv", "bin", "pyright")
        if not os.path.exists(pyright_path):
            pyright_path = "pyright"
            
        safe_path = context.get_safe_path(path)
        result = subprocess.run([pyright_path, "--outputjson", safe_path], capture_output=True, text=True)
        if result.returncode == 0:
            return "No se encontraron errores de tipo."
        return result.stdout
    except Exception as e:
        logger.error(f"Error ejecutando pyright: {e}")
        return f"Error ejecutando pyright: {e}"

def notify_user(mensaje: str = "") -> str:
    """Triggers a system notification with a Nerd Font bell icon and a specific sound alert."""
    import platform
    import subprocess
    import os

    if not mensaje:
        mensaje = "Task completed"



    try:
        system = platform.system()
        current_file = os.path.abspath(__file__)
        tools_dir = os.path.dirname(current_file)
        paser_dir = os.path.dirname(tools_dir)
        sound_path = os.path.join(paser_dir, "assets", "type.wav")

        if not os.path.exists(sound_path):
            print('\a', end='', flush=True)
            logger.warning(f"Archivo de sonido no encontrado: {sound_path}")
            return "Visual notification delivered (sound file missing)."

        if system == "Linux":
            try:
                subprocess.Popen(["paplay", sound_path], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            except:
                subprocess.Popen(["aplay", sound_path], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        elif system == "Darwin":
            subprocess.Popen(["afplay", sound_path], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        elif system == "Windows":
            import winsound
            winsound.PlaySound(sound_path, winsound.SND_FILENAME | winsound.SND_ASYNC)
        else:
            print('\a', end='', flush=True)

        return "Notification delivered"
    except Exception as e:
        logger.error(f"Error al intentar notificar: {e}")
        return f"Error delivering notification: {e}"
