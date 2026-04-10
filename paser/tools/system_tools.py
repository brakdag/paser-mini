import subprocess
import os
import logging
import re
import time
import glob
import shlex
from typing import Optional, Dict, Any
from .core_tools import context
from paser.core.ui import print_info, notify_user

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
    sound_path = os.path.join(context.root, "paser", "assets", "type.wav")

    if not os.path.exists(sound_path):
        return f"Sound file not found at: {sound_path}. Sent ASCII bell alert."
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

def set_timer(seconds: int, message: Optional[str] = None) -> str:
    """Sets a timer that will inject an event directly into the agent's event queue."""
    if message is None:
        message = "Timer"
    try:
        event_manager.add_event(seconds, message)
        return f"Timer scheduled for {seconds} seconds with message: {message}"
    except Exception as e:
        return f"Failed to set timer: {str(e)}"

def compile_latex(path: str) -> str:
    """
    Compila un archivo LaTeX y devuelve las rutas del PDF y Log generados.
    """
    safe_path = context.get_safe_path(path)
    if not os.path.isabs(safe_path):
        safe_path = os.path.join(context.root, safe_path)
    
    working_dir = os.path.dirname(safe_path) or context.root
    file_stem = os.path.splitext(os.path.basename(safe_path))[0]
    pdf_path = os.path.join(working_dir, f"{file_stem}.pdf")
    log_path = os.path.join(working_dir, f"{file_stem}.log")

    try:
        subprocess.run(
            ["pdflatex", "-interaction=nonstopmode", safe_path],
            capture_output=True, text=True, cwd=working_dir
        )
        return f"Compilación finalizada.\nPDF: {pdf_path}\nLog: {log_path}"

    except Exception as e:
        return f"Error inesperado durante la compilación: {str(e)}"

def convert_image(input_path: str, output_path: str, extra_args: Optional[str] = None) -> str:
    """
    Convierte una imagen o PDF a otro formato usando ImageMagick (convert).
    Permite especificar páginas de PDF usando el formato 'archivo.pdf[0]'.
    extra_args: String con argumentos adicionales de ImageMagick (ej. '-crop 100x100+10+10').
    """
    try:
        # Validamos rutas
        in_safe = context.get_safe_path(input_path)
        out_safe = context.get_safe_path(output_path)
        
        if not os.path.isabs(in_safe):
            in_safe = os.path.join(context.root, in_safe)
        if not os.path.isabs(out_safe):
            out_safe = os.path.join(context.root, out_safe)

        # Construcción del comando
        cmd = ["convert"]
        if extra_args:
            cmd.extend(shlex.split(extra_args))
        
        cmd.extend([in_safe, out_safe])

        # Ejecutamos convert
        result = subprocess.run(
            cmd,
            capture_output=True, text=True
        )

        if result.returncode == 0:
            return f"Conversión exitosa: {in_safe} -> {out_safe}"
        else:
            return f"Error en la conversión: {result.stderr}"

    except Exception as e:
        return f"Error inesperado durante la conversión: {str(e)}"