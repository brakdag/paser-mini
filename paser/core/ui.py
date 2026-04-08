"""
paser/core/ui.py
Interfaz de consola con Rich: paneles, markdown, estilos.
"""

from rich.console import Console
from rich.panel import Panel
from rich.markdown import Markdown
from rich.text import Text
from rich.box import ROUNDED
from rich.live import Live
from prompt_toolkit import PromptSession
from prompt_toolkit.formatted_text import HTML
from prompt_toolkit.styles import Style
from contextlib import contextmanager
import threading
import time

console = Console()


def print_panel(title: str, message: str, box_type=ROUNDED, style: str = "none"):
    console.print(Panel(message, title=title, expand=False, box=box_type, border_style=style))


def print_error(message: str):
    console.print(Panel(message, title="󰅚 Error", border_style="red"))


def print_info(message: str):
    console.print(Panel(message, title="󰋽 Info", border_style="blue"))


def print_model_response(text: str):
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
            title="󰒓 Tool Call",
            border_style="magenta",
            expand=False,
        )
    )


def print_tool_result(tool_name: str, result: str):
    console.print(
        Panel(result[:200] if len(result) > 200 else result,
              title=f"󰄵 {tool_name}",
              border_style="green",
              expand=False)
    )


async def get_input(prompt_text: str, history=None) -> str:
    style = Style.from_dict({
        '': '#00FF00',
        'prompt': '#00FF00 bold',
    })
    session = PromptSession(history=history)
    return await session.prompt_async(prompt_text, style=style)


@contextmanager
def SpinnerContext(message: str = "", color: str = "cyan"):
    """Muestra un spinner profesional usando rich.console.status."""
    with console.status(f"[{color}]{message}[/{color}]", spinner="dots"):
        yield
