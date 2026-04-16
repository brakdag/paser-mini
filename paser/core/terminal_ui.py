"""
paser/core/terminal_ui.py
Concrete implementation of UserInterface for the terminal using rich and prompt_toolkit.
"""

import sys
import logging
from typing import Any, Optional

from prompt_toolkit import PromptSession
from prompt_toolkit.styles import Style
from rich.console import Console
from rich.markdown import Markdown
from rich.panel import Panel
from rich.text import Text

from .latex_translator import LatexTranslator
from .ui_bindings import UIBindings

logger = logging.getLogger("ui")

class UIState:
    INSERT = "INSERT"
    NORMAL = "NORMAL"

class TerminalUI:
    def __init__(self):
        self.mode = UIState.INSERT
        self.last_cursor_pos = 0
        self._session = None
        self.console = Console()
        
        self.style = Style.from_dict({
            '': '#cad3f5',
            'prompt': '#a6e3a1 bold',
            'thinking': '#b4befe bold',
            'normal': '#f9e2af bold',
            'insert': '#a6e3a1 bold',
            'spinner_msg': '#cba6f7',
            'dim': '#9399b2',
        })
        
        # Modularized keybindings
        self.kb = UIBindings.get_bindings(self)

    async def request_input(self, prompt: str, history: Optional[Any] = None) -> str:
        if self._session is None:
            self._session = PromptSession(history=history)
        
        return await self._session.prompt_async(
            prompt, key_bindings=self.kb
        )

    def display_message(self, text: str):
        text = LatexTranslator.translate(text)
        self.console.print(Markdown(text))

    def display_thought(self, text: str):
        self.console.print(Text(f"💭 {text}", style="dim italic"))

    def display_tool_start(self, tool_name: str, args: dict):
        self.console.print(Text(f"🛠️  Executing {tool_name}...", style="bold cyan"))

    def display_tool_result(self, tool_name: str, success: bool, result: Any, detail: str = ""):
        color = "green" if success else "red"
        icon = "✅" if success else "❌"
        self.console.print(Text(f"{icon} {tool_name} completed", style=color))

    def display_tool_status(self, tool_name: str, success: bool, detail: str = ""):
        color = "green" if success else "red"
        self.console.print(Text(f"[{tool_name}] Status: {detail}", style=color))

    def display_panel(self, title: str, message: str, style: str = "none"):
        self.console.print(Panel(message, title=title, border_style=style))

    def display_error(self, message: str):
        self.console.print(Panel(Text(message, style="bold red"), title="Error", border_style="red"))

    def display_info(self, message: str):
        self.console.print(Panel(Text(message, style="blue"), title="Info", border_style="blue"))

    def get_spinner(self, message: str, color: str = "cyan", newline: bool = False):
        return None

    def set_ui_mode(self, mode: str):
        self.mode = mode

    def get_ui_mode(self) -> str:
        return self.mode

    async def get_confirmation(self, message: str) -> bool:
        response = await self.request_input(f"{message} (y/n): ")
        return response.lower().strip() == 'y'
