"""
paser/core/ui.py
Legacy UI interface. Redirects to TerminalUI or provides basic utilities.
"""

import sys
import re
from rich.console import Console
from rich.panel import Panel
from rich.markdown import Markdown
from rich.text import Text
from rich.box import ROUNDED
from prompt_toolkit import PromptSession
from prompt_toolkit.key_binding import KeyBindings
from prompt_toolkit.formatted_text import HTML
from prompt_toolkit.styles import Style
from prompt_toolkit.buffer import Buffer, Document
from contextlib import contextmanager
import logging

logger = logging.getLogger("ui")

console = Console()

# --- Vim Mode State Management ---

class UIState:
    INSERT = "INSERT"
    NORMAL = "NORMAL"
    AUDIO = "AUDIO"
    
    def __init__(self):
        self.mode = self.INSERT
        self.last_cursor_pos = 0

ui_state = UIState()



# Global session to maintain state and bindings
_session = None

def get_session(history=None):
    global _session
    if _session is None:
        _session = PromptSession(history=history)
    return _session

# Key Bindings for Vim-like navigation
kb = KeyBindings()

@kb.add('escape')
def _(event):
    ui_state.last_cursor_pos = event.current_buffer.cursor_position
    ui_state.mode = UIState.NORMAL

@kb.add('i')
def _(event):
    if ui_state.mode == UIState.NORMAL:
        ui_state.mode = UIState.INSERT
        event.current_buffer.cursor_position = ui_state.last_cursor_pos
    else:
        event.current_buffer.insert_text('i')

@kb.add('j')
def _(event):
    if ui_state.mode == UIState.NORMAL:
        sys.stdout.write('\x1b[6~') # Page Down
        sys.stdout.flush()
    else:
        event.current_buffer.insert_text('j')

@kb.add('k')
def _(event):
    if ui_state.mode == UIState.NORMAL:
        sys.stdout.write('\x1b[5~') # Page Up
        sys.stdout.flush()
    else:
        event.current_buffer.insert_text('k')

@kb.add('h')
def _(event):
    if ui_state.mode == UIState.NORMAL:
        event.current_buffer.cursor_left()
    else:
        event.current_buffer.insert_text('h')

@kb.add('l')
def _(event):
    if ui_state.mode == UIState.NORMAL:
        event.current_buffer.cursor_right()
    else:
        event.current_buffer.insert_text('l')

import string

# Callback global para el sistema de audio
audio_callback = None

# Registrar bindings para bloquear la escritura en modo NORMAL
special_vim_keys = {'h', 'j', 'k', 'l', 'i'}
# Caracteres a bloquear en modo NORMAL (incluyendo variantes de AltGr+V)
# Excluimos la 'v' de aquí para que su binding especial tenga control total
chars_to_block = (string.ascii_letters + string.digits + " " + "„¥√").replace('v', '').replace('V', '')
for char in chars_to_block:
    if char.lower() in special_vim_keys:
        continue
    
    @kb.add(char)
    def _(event, c=char):
        if ui_state.mode == UIState.NORMAL:
            return # Bloquea la escritura
        event.current_buffer.insert_text(c)

@kb.add('v')
def _(event):
    # Si estamos en modo NORMAL o AUDIO, la 'v' gestiona el micrófono
    if ui_state.mode in (UIState.NORMAL, UIState.AUDIO):
        if audio_callback:
            audio_callback()
    # Solo si estamos en modo INSERT, la 'v' escribe la letra
    else:
        event.current_buffer.insert_text('v')

class VimBuffer(Buffer):
    """Buffer personalizado que bloquea la inserción de texto en modo NORMAL."""
    def handle_input(self, key):
        if ui_state.mode == UIState.NORMAL:
            # Definimos las teclas que sí están permitidas en modo NORMAL
            # Incluimos las de navegación y la tecla 'i' para volver a INSERT
            allowed_keys = ['h', 'j', 'k', 'l', 'i', 'escape']
            
            # Si la tecla no es una de las permitidas, la ignoramos
            if hasattr(key, 'char') and key.char not in allowed_keys:
                return
            if not hasattr(key, 'char') and key not in allowed_keys:
                # Para teclas especiales (como Esc), permitimos que pasen
                pass
        
        return super().handle_input(key)

def get_bottom_toolbar():
    """Returns the status bar based on the current UI mode."""
    if ui_state.mode == UIState.NORMAL:
        return HTML('<ansiyellow> <b>— NORMAL —</b> </ansiyellow> (h/j/k/l: navigate, i: insert)')
    return HTML('<ansigreen> <b>— INSERT —</b> </ansigreen> (Esc: normal)')

# Mapping of LaTeX commands to Unicode characters
LATEX_TO_UNICODE = {
    # Greek Alphabet (Lowercase)
    r"\alpha": "\u03b1",
    r"\beta": "\u03b2",
    r"\gamma": "\u03b3",
    r"\delta": "\u03b4",
    r"\epsilon": "\u03b5",
    r"\zeta": "\u03b6",
    r"\eta": "\u03b7",
    r"\theta": "\u03b8",
    r"\iota": "\u03b9",
    r"\kappa": "\u03ba",
    r"\lambda": "\u03bb",
    r"\mu": "\u03bc",
    r"\nu": "\u03bd",
    r"\xi": "\u03be",
    r"\pi": "\u03c0",
    r"\rho": "\u03c1",
    r"\sigma": "\u03c3",
    r"\tau": "\u03c4",
    r"\upsilon": "\u03c5",
    r"\phi": "\u03c6",
    r"\chi": "\u03c7",
    r"\psi": "\u03c8",
    r"\omega": "\u03c9",
    # Greek Alphabet (Uppercase)
    r"\Gamma": "\u0393",
    r"\Delta": "\u2206",
    r"\Theta": "\u0398",
    r"\Lambda": "\u039b",
    r"\Sigma": "\u03a3",
    r"\Phi": "\u03a6",
    r"\Psi": "\u03a8",
    r"\Omega": "\u03a9",
    # Logical & Set Operators
    r"\forall": "\u2200",
    r"\exists": "\u2203",
    r"\in": "\u2208",
    r"\notin": "\u2209",
    r"\subset": "\u2282",
    r"\supset": "\u2283",
    r"\cup": "\u222a",
    r"\cap": "\u2229",
    r"\emptyset": "\u2205",
    r"\wedge": "\u2227",
    r"\vee": "\u2228",
    r"\neg": "\u00ac",
    r"\implies": "\u21d2",
    r"\iff": "\u21d4",
    # Arrows & Relations
    r"\rightarrow": "\u2192",
    r"\leftarrow": "\u2190",
    r"\leftrightarrow": "\u2194",
    r"\Rightarrow": "\u21d2",
    r"\Leftarrow": "\u21d0",
    r"\Leftrightarrow": "\u21d4",
    r"\approx": "\u2248",
    r"\sim": "\u223c",
    r"\equiv": "\u2261",
    r"\propto": "\u221d",
    r"\neq": "\u2260",
    r"\le": "\u2264",
    r"\ge": "\u2265",
    # Operators
    r"\times": "\u00d7",
    r"\div": "\u00f7",
    r"\pm": "\u00b1",
    r"\mp": "\u00b1",
    r"\cdot": "\u22c5",
    r"\ast": "\u2217",
    # Calculus & Analysis
    r"\int": "\u222b",
    r"\sum": "\u2211",
    r"\prod": "\u220f",
    r"\partial": "\u2202",
    r"\nabla": "\u2207",
    r"\infty": "\u221e",
    # Number Sets
    r"\mathbb{R}": "\u211d",
    r"\mathbb{Z}": "\u2124",
    r"\mathbb{N}": "\u2115",
    r"\mathbb{Q}": "\u211a",
    r"\mathbb{C}": "\u2102",
}

# Sort keys by length descending to prevent overlapping prefix matches (e.g., \int vs \in)
_SORTED_KEYS = sorted(LATEX_TO_UNICODE.keys(), key=len, reverse=True)
_COMMAND_PATTERN = re.compile("|".join(re.escape(k) for k in _SORTED_KEYS))
# Regex to find LaTeX blocks $...$
_BLOCK_PATTERN = re.compile(r"\$(.*?)\$")

def translate_latex_to_unicode(text: str) -> str:
    """Replaces LaTeX blocks with their Unicode equivalents."""
    def replace_block(match):
        content = match.group(1)
        # Translate commands within the block
        translated = _COMMAND_PATTERN.sub(lambda m: LATEX_TO_UNICODE[m.group(0)], content)
        return translated

    return _BLOCK_PATTERN.sub(replace_block, text)

# --- UI Helpers ---

def print_panel(title: str, message: str, box_type=ROUNDED, style: str = "none"):
    console.print(Panel(message, title=title, expand=False, box=box_type, border_style=style))

def print_error(message: str):
    console.print(Panel(message, title="❌ Error", border_style="red"))

def print_info(message: str):
    console.print(Panel(message, title="ℹ️ Info", border_style="blue"))

def print_model_response(text: str):
    text = translate_latex_to_unicode(text)
    try:
        md = Markdown(text)
        console.print(md)
    except Exception:
        console.print(Text(text, style="cyan"))
    console.print()

def print_tool_call(tool_name: str, args: dict):
    console.print(
        Panel(
            f"```json\n{{\"name\": \"{tool_name}\", \"args\": {args}}}\n```",
            title="🛠️ Tool Call",
            border_style="magenta",
            expand=False,
        )
    )

def print_tool_result(tool_name: str, result: str):
    console.print(
        Panel(result[:200] if len(result) > 200 else result,
              title=f"📦 {tool_name}",
              border_style="green",
              expand=False)
    )

async def async_get_confirmation(message: str) -> bool:
    """Asynchronous confirmation prompt for security-sensitive tools."""
    response = await get_input(f"{message} (y/n): ")
    return response.lower().strip() == 'y'

async def get_input(prompt_text: str, history=None) -> str:
    style = Style.from_dict({
        '': '#00FF00',
        'prompt': '#00FF00 bold',
    })
    
    session = get_session(history=history)
    
    return await session.prompt_async(
        prompt_text, 
        style=style, 
        key_bindings=kb, 
        bottom_toolbar=get_bottom_toolbar
    )

def notify_user(message: str = "Una acción importante ha sido completada exitosamente.") -> str:
    """Triggers a visual notification in the chat interface with a custom message."""
    print_info(f"🔔 Notificación del Sistema: {message}")
    return f"Notificación visual enviada: {message}"

class SpinnerContext:
    """Context manager for displaying a loading spinner in the console."""
    def __init__(self, message: str = "", color: str = "cyan", newline: bool = False):
        self.message = message
        self.color = color
        self.newline = newline
        self.previous_mode = None
        self._status = None

    def __enter__(self):
        self.previous_mode = ui_state.mode
        ui_state.mode = UIState.NORMAL
        
        if self.newline:
            console.print()
            
        status_msg = f"[{self.color}]{self.message}[/{self.color}]" if self.color else self.message
        
        self._status = console.status(status_msg, spinner="material")
        return self._status.__enter__()

    def __exit__(self, exc_type, exc_val, exc_tb):
        if self._status:
            self._status.__exit__(exc_type, exc_val, exc_tb)
        ui_state.mode = self.previous_mode
