import subprocess
import os
import logging
import re
import time
import glob
import shlex
import requests
import tempfile
import threading
from gtts import gTTS
from typing import Optional, Dict, Any
from .core_tools import context
from paser.core.ui import print_info, notify_user

logger = logging.getLogger("tools")

# Estado global para la gestión de música
_music_state = {
    "process": None,
    "file": None
}

def _cleanup_music_file(process, file_path):
    """Hilo que espera a que el proceso de música termine para borrar el archivo."""
    global _music_state
    
    if process:
        try:
            process.wait()
        except Exception:
            pass
    
    if file_path and os.path.exists(file_path):
        try:
            os.remove(file_path)
            logger.info(f"Temporary music file cleaned up: {file_path}")
        except Exception as e:
            logger.error(f"Error cleaning up music file: {e}")
    
    # Solo limpiamos el estado global si sigue siendo el mismo proceso que este hilo estaba monitoreando
    if _music_state["process"] == process:
        _music_state["process"] = None
    if _music_state["file"] == file_path:
        _music_state["file"] = None

def stop_music() -> str:
    """
    Detiene la reproducción de música actual si existe.
    """
    global _music_state
    if _music_state["process"] is None:
        return "No hay ninguna música reproduciéndose actualmente."
    
    try:
        _music_state["process"].terminate()
        return "Reproducción detenida exitosamente."
    except Exception as e:
        logger.error(f"Error stopping music: {e}")
        return f"Error al detener la música: {str(e)}"

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

def play_music(query: str) -> str:
    """
    Busca una canción en archive.org, intenta encontrar la pista que mejor coincida con la consulta,
    la descarga temporalmente y la reproduce usando mpv.
    """
    global _music_state
    try:
        # 1. Búsqueda en Archive.org
        logger.info(f"Searching archive.org for: {query}")
        search_url = "https://archive.org/advancedsearch.php"
        params = {
            "q": f"{query} AND mediatype:audio",
            "fl[]": "identifier",
            "output": "json",
            "rows": 1
        }
        
        response = requests.get(search_url, params=params, timeout=(5, 15))
        response.raise_for_status()
        data = response.json()
        
        docs = data.get("response", {}).get("docs", [])
        if not docs:
            return f"No se encontraron resultados para '{query}' en archive.org."
        
        identifier = docs[0]["identifier"]
        
        # 2. Obtener lista de archivos del identificador
        logger.info(f"Fetching metadata for identifier: {identifier}")
        metadata_url = f"https://archive.org/metadata/{identifier}"
        meta_response = requests.get(metadata_url, timeout=(5, 15))
        meta_response.raise_for_status()
        meta_data = meta_response.json()
        
        files = meta_data.get("files", [])
        mp3_files = [f["name"] for f in files if f["name"].endswith(".mp3")]
        
        if not mp3_files:
            return f"Se encontró el item '{identifier}', pero no contiene archivos MP3."
        
        # 3. Selección de la mejor pista (Best-Match)
        query_norm = query.lower()
        scored_files = []
        for f in mp3_files:
            score = 0
            fname = f.lower()
            if query_norm in fname:
                score += 10
            words = query_norm.split()
            for word in words:
                if len(word) > 2 and word in fname:
                    score += 1
            scored_files.append((score, f))
        
        scored_files.sort(key=lambda x: x[0], reverse=True)
        
        # 4. Intento de descarga (probando los mejores matches primero)
        success = False
        last_error = ""
        
        for score, mp3_file in scored_files:
            download_url = f"https://archive.org/download/{identifier}/{mp3_file}"
            logger.info(f"Attempting to download best match (score {score}): {mp3_file}")
            
            try:
                with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as tmp_file:
                    tmp_path = tmp_file.name
                    with requests.get(download_url, stream=True, timeout=(5, 30)) as r:
                        if r.status_code == 401:
                            logger.warning(f"401 Unauthorized for {mp3_file}, trying next match...")
                            if os.path.exists(tmp_path):
                                os.remove(tmp_path)
                            last_error = "401 Unauthorized"
                            continue
                        r.raise_for_status()
                        for chunk in r.iter_content(chunk_size=8192):
                            if chunk:
                                tmp_file.write(chunk)
                
                success = True
                break
            except Exception as e:
                logger.warning(f"Failed to download {mp3_file}: {e}")
                if 'tmp_path' in locals() and os.path.exists(tmp_path):
                    os.remove(tmp_path)
                last_error = str(e)
                continue

        if not success:
            return f"No se pudo descargar ninguna pista compatible con '{query}'. Último error: {last_error}"
        
        # 5. Transición
        if _music_state["process"] is not None:
            logger.info("Terminating previous playback for seamless transition.")
            _music_state["process"].terminate()

        # 6. Reproducción asíncrona
        logger.info(f"Starting playback for: {mp3_file}")
        process = subprocess.Popen(
            ["mpv", "--no-video", tmp_path], 
            stdout=subprocess.DEVNULL, 
            stderr=subprocess.DEVNULL
        )
        
        _music_state["process"] = process
        _music_state["file"] = tmp_path
        
        cleanup_thread = threading.Thread(
            target=_cleanup_music_file, 
            args=(process, tmp_path), 
            daemon=True
        )
        cleanup_thread.start()
        
        return f"Reproducción iniciada: {mp3_file}. Puedes detenerla usando 'stop_music'."
                
    except requests.RequestException as e:
        logger.error(f"Network error in play_music: {str(e)}")
        return f"Error de red al acceder a archive.org: {str(e)}"
    except Exception as e:
        logger.error(f"Unexpected error in play_music: {str(e)}", exc_info=True)
        return f"Error inesperado: {str(e)}"

def speak_text(text: str, lang: str = 'es') -> str:
    """
    Converts text to speech using gTTS and plays it using mpv.
    """
    global _music_state
    try:
        logger.info(f"Synthesizing text: {text[:50]}...")
        tts = gTTS(text=text, lang=lang)
        
        with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as tmp_file:
            tmp_path = tmp_file.name
            tts.save(tmp_path)
        
        # Stop current playback if any
        if _music_state["process"] is not None:
            _music_state["process"].terminate()

        # Play asynchronously
        process = subprocess.Popen(
            ["mpv", "--no-video", tmp_path], 
            stdout=subprocess.DEVNULL, 
            stderr=subprocess.DEVNULL
        )
        
        _music_state["process"] = process
        _music_state["file"] = tmp_path
        
        cleanup_thread = threading.Thread(
            target=_cleanup_music_file, 
            args=(process, tmp_path), 
            daemon=True
        )
        cleanup_thread.start()
        
        return f"Speaking: {text}"
    except Exception as e:
        logger.error(f"Error in speak_text: {e}", exc_info=True)
        return f"Error in text-to-speech: {str(e)}"