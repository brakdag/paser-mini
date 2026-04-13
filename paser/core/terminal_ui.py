"""
paser/core/terminal_ui.py
Concrete implementation of UserInterface for the terminal using Rich and prompt_toolkit.
"""

import sys
import re
import string
import logging
from datetime import datetime
from typing import Any, Optional

from rich.console import Console
from rich.panel import Panel
from rich.markdown import Markdown
from rich.text import Text
from rich.live import Live
from rich.text import Text
from prompt_toolkit import PromptSession
from prompt_toolkit.key_binding import KeyBindings
from prompt_toolkit.formatted_text import FormattedText
from prompt_toolkit.styles import Style

from paser.core.ui_interface import UserInterface

logger = logging.getLogger("ui")

class UIState:
    INSERT = "INSERT"
    NORMAL = "NORMAL"
    AUDIO = "AUDIO"

class TerminalUI(UserInterface):
    def __init__(self):
        self.console = Console()
        self.mode = UIState.INSERT
        self.last_cursor_pos = 0
        self._session = None
        self.audio_callback = None
        self.kb = KeyBindings()
        self.current_spinner_message: Optional[str] = None
        
        # Paleta de colores estilo Catppuccin Machiato definida globalmente
        self.style = Style.from_dict({
            '': '#cad3f5',              # Texto general
            'prompt': '#a6e3a1 bold',   # El prompt │ ➜
            'thinking': '#b4befe bold', # Estado Thinking
            'normal': '#f9e2af bold',   # Modo Normal
            'insert': '#a6e3a1 bold',   # Modo Insert
            'spinner_msg': '#cba6f7',   # Mensaje del spinner
            'dim': '#9399b2',           # Texto de ayuda
        })
        
        self._setup_key_bindings()

    def _setup_key_bindings(self):
        @self.kb.add('escape')
        def _(event):
            self.last_cursor_pos = event.current_buffer.cursor_position
            self.mode = UIState.NORMAL

        @self.kb.add('i')
        def _(event):
            if self.mode == UIState.NORMAL:
                self.mode = UIState.INSERT
                event.current_buffer.cursor_position = self.last_cursor_pos
            else:
                event.current_buffer.insert_text('i')

        @self.kb.add('j')
        def _(event):
            if self.mode == UIState.NORMAL:
                sys.stdout.write('\x1b[6~')
                sys.stdout.flush()
            else:
                event.current_buffer.insert_text('j')

        @self.kb.add('k')
        def _(event):
            if self.mode == UIState.NORMAL:
                sys.stdout.write('\x1b[5~')
                sys.stdout.flush()
            else:
                event.current_buffer.insert_text('k')

        @self.kb.add('h')
        def _(event):
            if self.mode == UIState.NORMAL:
                event.current_buffer.cursor_left()
            else:
                event.current_buffer.insert_text('h')

        @self.kb.add('l')
        def _(event):
            if self.mode == UIState.NORMAL:
                event.current_buffer.cursor_right()
            else:
                event.current_buffer.insert_text('l')

        @self.kb.add('v')
        def _(event):
            if self.mode in (UIState.NORMAL, UIState.AUDIO):
                if self.audio_callback:
                    self.audio_callback()
            else:
                event.current_buffer.insert_text('v')

        special_vim_keys = {'h', 'j', 'k', 'l', 'i'}
        chars_to_block = (string.ascii_letters + string.digits + " " + "„¥√").replace('v', '').replace('V', '')
        for char in chars_to_block:
            if char.lower() in special_vim_keys: continue
            @self.kb.add(char)
            def _(event, c=char):
                if self.mode == UIState.NORMAL: return
                event.current_buffer.insert_text(c)

    def _get_bottom_toolbar(self):
        parts = []
        
        # Si hay un spinner activo, mostramos el estado de THINKING
        if self.current_spinner_message:
            parts.append(('#cba6f7', f' ⌛ {self.current_spinner_message} '))
            parts.append(('#b4befe bold', ' — THINKING — '))
        
        if self.mode == UIState.NORMAL:
            parts.append(('#f9e2af bold', ' — NORMAL — '))
            parts.append(('#9399b2', ' (h/j/k/l: navigate, i: insert)'))
        else:
            parts.append(('#a6e3a1 bold', ' — INSERT — '))
            parts.append(('#9399b2', ' (Esc: normal)'))
            
        return FormattedText(parts)

    def _translate_latex(self, text: str) -> str:
        LATEX_TO_UNICODE = {
            r"\alpha": "\u03b1", r"\beta": "\u03b2", r"\gamma": "\u03b3", r"\delta": "\u03b4",
            r"\epsilon": "\u03b5", r"\zeta": "\u03b6", r"\eta": "\u03b7", r"\theta": "\u03b8",
            r"\iota": "\u03b9", r"\kappa": "\u03ba", r"\lambda": "\u03bb", r"\mu": "\u03bc",
            r"\nu": "\u03bd", r"\xi": "\u03be", r"\pi": "\u03c0", r"\rho": "\u03c1",
            r"\sigma": "\u03c3", r"\tau": "\u03c4", r"\upsilon": "\u03c5", r"\phi": "\u03c6",
            r"\chi": "\u03c7", r"\psi": "\u03c8", r"\omega": "\u03c9",
            r"\Gamma": "\u0393", r"\Delta": "\u2206", r"\Theta": "\u0398", r"\Lambda": "\u039b",
            r"\Sigma": "\u03a3", r"\Phi": "\u03a6", r"\Psi": "\u03a8", r"\Omega": "\u03a9",
            r"\forall": "\u2200", r"\exists": "\u2203", r"\in": "\u2208", r"\notin": "\u2209",
            r"\subset": "\u2282", r"\supset": "\u2283", r"\cup": "\u222a", r"\cap": "\u2229",
            r"\emptyset": "\u2205", r"\wedge": "\u2227", r"\vee": "\u2228", r"\neg": "\u00ac",
            r"\implies": "\u21d2", r"\iff": "\u21d4", r"\rightarrow": "\u2192", r"\leftarrow": "\u2190",
            r"\leftrightarrow": "\u2194", r"\Rightarrow": "\u21d2", r"\Leftarrow": "\u21d0",
            r"\Leftrightarrow": "\u21d4", r"\approx": "\u2248", r"\sim": "\u223c",
            r"\equiv": "\u2261", r"\propto": "\u221d", r"\neq": "\u2260", r"\le": "\u2264",
            r"\ge": "\u2265", r"\times": "\u00d7", r"\div": "\u00f7", r"\pm": "\u00b1",
            r"\mp": "\u00b1", r"\cdot": "\u22c5", r"\ast": "\u2217", r"\int": "\u222b",
            r"\sum": "\u2211", r"\prod": "\u220f", r"\partial": "\u2202", r"\nabla": "\u2207",
            r"\infty": "\u221e", r"\mathbb{R}": "\u211d", r"\mathbb{Z}": "\u2124",
            r"\mathbb{N}": "\u2115", r"\mathbb{Q}": "\u211a", r"\mathbb{C}": "\u2102",
        }
        sorted_keys = sorted(LATEX_TO_UNICODE.keys(), key=len, reverse=True)
        pattern = re.compile("|".join(re.escape(k) for k in sorted_keys))
        block_pattern = re.compile(r"\$(.*?)\$")
        def replace_block(match):
            content = match.group(1)
            return pattern.sub(lambda m: LATEX_TO_UNICODE[m.group(0)], content)
        return block_pattern.sub(replace_block, text)

    async def request_input(self, prompt: str, history: Optional[Any] = None) -> str:
        if self._session is None:
            self._session = PromptSession(history=history)
        
        return await self._session.prompt_async(
            prompt, style=self.style, key_bindings=self.kb, bottom_toolbar=self._get_bottom_toolbar
        )

    def display_message(self, text: str):
        text = self._translate_latex(text)
        try:
            self.console.print(Markdown(text))
        except Exception:
            self.console.print(Text(text, style="cyan"))
        self.console.print()

    def display_thought(self, text: str):
        self.console.print("Thinking...")
        self.console.print(Markdown(text))

    def display_tool_start(self, tool_name: str, args: dict):
        self.console.print(Panel(f"```json\n{{\"name\": \"{tool_name}\", \"args\": {args}}}\n```", title="🛠️ Tool Call", border_style="magenta", expand=False))

    def display_tool_result(self, tool_name: str, success: bool, result: Any, detail: str = ""):
        status_icon = "✓" if success else "✗"
        res_text = f"{detail} {str(result)}" if detail else str(result)
        res_text = res_text[:200] if len(res_text) > 200 else res_text
        self.console.print(Panel(f"{res_text} {status_icon}", title=f"📦 {tool_name}", border_style="green" if success else "red", expand=False))

    def display_tool_status(self, tool_name: str, success: bool, detail: str = ""):
        from paser.core.tool_registry import FILE_TOOLS, get_tool_metadata
        status_icon = "✓" if success else "✗"
        verb, icon = get_tool_metadata(tool_name)
        prefix = "📁" if tool_name in FILE_TOOLS else "⚙️"
        self.console.print(f"  {prefix} {icon} {tool_name}{detail} {status_icon}")

    def display_panel(self, title: str, message: str, style: str = "none"):
        self.console.print(Panel(message, title=title, expand=False, border_style=style))

    def display_error(self, message: str):
        self.console.print(Panel(message, title="❌ Error", border_style="red"))

    def display_info(self, message: str):
        self.console.print(Panel(message, title="ℹ️ Info", border_style="blue"))

    def get_spinner(self, message: str, color: str = "cyan", newline: bool = False):
        return TerminalSpinner(self, message, color, newline)

    def set_ui_mode(self, mode: str):
        self.mode = mode

    def get_ui_mode(self) -> str:
        return self.mode

    async def get_confirmation(self, message: str) -> bool:
        """Asynchronous confirmation prompt for security-sensitive tools."""
        response = await self.request_input(f"{message} (y/n): ")
        return response.lower().strip() == 'y'

class SpinnerRenderable:
    """Renderizador personalizado para controlar la posición del spinner y la hora."""
    def __init__(self, ui, message):
        self.ui = ui
        self.message = message
        self.frames = ["◊", "○", "◔", "◐", "◘", "◔"]
        self.frame_idx = 0

    def __rich__(self):
        frame = self.frames[self.frame_idx]
        self.frame_idx = (self.frame_idx + 1) % len(self.frames)
        
        label = " — THINKING — "
        time_str = datetime.now().strftime("%H:%M:%S ")
        display_msg = self.message if self.message else "Thinking..."
        
        # Usamos self.ui.console para obtener el ancho
        console_width = self.ui.console.width
        
        # Cálculo de ancho para evitar el wrap
        available_width = console_width - len(label) - len(time_str) - 5
        truncated_msg = (display_msg[:available_width-3] + "...") if len(display_msg) > available_width else display_msg
        
        # Construcción de la línea con padding dinámico
        current_content_len = len(label) + len(truncated_msg) + 3
        padding = " " * max(0, console_width - current_content_len - len(time_str))
        
        # Creamos el objeto Text con estilos específicos por rango
        line = Text(f"{label} {frame} {truncated_msg}{padding}{time_str}", style="on #494d64")
        line.stylize("#b4befe bold", 0, len(label))
        line.stylize("#cba6f7", len(label), len(label) + len(truncated_msg) + 2)
        line.stylize("#9399b2", -len(time_str), None)
        
        return line

class TerminalSpinner:
    def __init__(self, ui: TerminalUI, message: str, color: str, newline: bool):
        self.ui = ui
        self.message = message
        self.color = color
        self.newline = newline
        self.live = None

    def __enter__(self):
        self.previous_mode = self.ui.mode
        if self.newline and self.ui.current_spinner_message is None:
            self.ui.console.print()

        self.ui.mode = UIState.NORMAL
        self.ui.current_spinner_message = self.message
            
        # Usamos Live en lugar de Status para control total de la línea
        self.live = Live(SpinnerRenderable(self.ui, self.message), console=self.ui.console, auto_refresh=True, transient=True)
        self.live.start()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        if self.live:
            self.live.stop()
        self.ui.current_spinner_message = None
        self.ui.mode = self.previous_mode
