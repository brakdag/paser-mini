import subprocess
import os
import logging
from .core_tools import context
from paser.core.ui import print_info, notify_user
from paser.core.ui import print_info

logger = logging.getLogger("tools")

def analyze_pyright(path: str = ".") -> str:
    """Analiza código usando pyright y devuelve errores si existen."""
    pyright_path = os.path.join(context.root, "venv", "bin", "pyright")
    if not os.path.exists(pyright_path):
        pyright_path = "pyright"
        
    safe_path = context.get_safe_path(path)
    result = subprocess.run([pyright_path, "--outputjson", safe_path], capture_output=True, text=True)
    if result.returncode == 0:
        return "No se encontraron errores de tipo."
    return result.stdout

def notify_user(message: str = "Una acción importante ha sido completada exitosamente.") -> str:
    """Triggers a visual notification in the chat interface with a custom message."""
    print_info(f"🔔 Notificación del Sistema: {message}")
    return f"Notificación visual enviada: {message}"

def alert_sound() -> str:
    """Plays a system alert sound to get the user's attention."""
    sound_path = os.path.join(context.root, "assets", "type.wav")

    if not os.path.exists(sound_path):
        print('\a', end='', flush=True)
        return "Sound file not found, sent ASCII bell alert."

    try:
        # Default to Linux/ALSA/PulseAudio
        subprocess.Popen(["paplay", sound_path], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    except Exception:
        try:
            subprocess.Popen(["aplay", sound_path], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        except Exception:
            print('\a', end='', flush=True)

    return "Alert sound played successfully."

def is_window_in_focus(**kwargs) -> str:
    """Verifica si la ventana de la terminal tiene el foco actual del sistema."""
    try:
        result = subprocess.run(["xdotool", "getactivewindow", "getwindowname"], 
                                capture_output=True, text=True, check=True)
        window_name = result.stdout.strip().lower()
        terminal_keywords = ["terminal", "console", "kitty", "alacritty", "konsole", "gnome-terminal", "iterm", "hyper"]
        if any(kw in window_name for kw in terminal_keywords):
            return "True: The terminal is in focus."
        else:
            return f"False: The active window is '{window_name}'."
    except Exception:
        return "False: Could not determine window focus (xdotool missing?)."

from paser.core.event_manager import event_manager
from typing import Optional

def set_timer(seconds: int, message: Optional[str] = None) -> str:
    """Sets a timer that will inject an event directly into the agent's event queue."""
    if message is None:
        message = "Timer"
    try:
        event_manager.add_event(seconds, message)
        return f"Timer scheduled for {seconds} seconds with message: {message}"
    except Exception as e:
        return f"Failed to set timer: {str(e)}"
