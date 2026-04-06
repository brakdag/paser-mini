import subprocess
import os
import logging
from .core_tools import context

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

def notify_user(message: str = "") -> str:
    """Triggers a system notification. Note: Use Nerd Font glyphs compatible with JetBrains Mono for any visual cues."""
    import platform
    import subprocess
    import os

    if not message:
        message = "Task completed"
    else:
        # Si hay mensaje, lo imprimimos además del sonido
        print(f"\n🔔 {message}\n")

    system = platform.system()
    current_file = os.path.abspath(__file__)
    tools_dir = os.path.dirname(current_file)
    paser_dir = os.path.dirname(tools_dir)
    sound_path = os.path.join(paser_dir, "assets", "type.wav")

    if not os.path.exists(sound_path):
        print('\a', end='', flush=True)
        logger.warning(f"Sound file not found: {sound_path}")
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

def is_window_in_focus(**kwargs) -> str:
    """Verifica si la ventana de la terminal tiene el foco actual del sistema."""
    # Intentamos obtener el nombre de la ventana activa usando xdotool
    try:
        result = subprocess.run(["xdotool", "getactivewindow", "getwindowname"], 
                                capture_output=True, text=True, check=True)
        window_name = result.stdout.strip().lower()
        
        # Palabras clave comunes de terminales
        terminal_keywords = ["terminal", "console", "kitty", "alacritty", "konsole", "gnome-terminal", "iterm", "hyper"]
        
        if any(kw in window_name for kw in terminal_keywords):
            return "True: The terminal is in focus."
        else:
            return f"False: The active window is '{window_name}'."
    except Exception:
        return "False: Could not determine window focus (xdotool missing?)."

def set_timer(seconds: int, message: str = "Timer finished") -> str:
    """Sets a timer that will trigger a system notification after 'seconds' seconds in the background."""
    import platform
    import subprocess
    import os
    import sys

    # We'll use a small python one-liner to run in the background.
    # It will sleep and then try to use system commands to notify.
    
    python_exe = sys.executable
    
    # Constructing the command to run in background
    # We want to: sleep(seconds) -> notify
    
    if platform.system() == "Linux":
        # Use notify-send if available, otherwise just print bell
        cmd = f"import time; time.sleep({seconds}); import subprocess; subprocess.run(['notify-send', {repr(message)}])"
    elif platform.system() == "Darwin":
        # Use osascript for macOS
        cmd = f"import time; time.sleep({seconds}); import subprocess; subprocess.run(['osascript', '-e', 'display notification ' + {repr(message)} + ' with title \"Paser Timer\"'])"
    elif platform.system() == "Windows":
        # Use PowerShell for Windows. Escape single quotes in the message.
        escaped_message = message.replace("'", "''")
        cmd = f"import time; time.sleep({seconds}); import subprocess; subprocess.run(['powershell', '-Command', \"Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.MessageBox]::Show('{escaped_message}', 'Paser Timer')\"])"
    else:
        cmd = f"import time; time.sleep({seconds}); print('\a')"

    try:
        subprocess.Popen([python_exe, "-c", cmd], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        return f"Timer set for {seconds} seconds: {message}"
    except Exception as e:
        return f"Failed to set timer: {str(e)}"
