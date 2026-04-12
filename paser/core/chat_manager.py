import json
import re
import os
import asyncio
import threading
from paser.core.logging import setup_logger
from paser.core.ui import console, get_input, print_model_response, SpinnerContext
from paser.core.commands import CommandHandler
from paser.core.executor import AutonomousExecutor
from paser.core.event_manager import event_manager
from paser.core.tool_registry import get_tool_metadata
from paser.core.config_manager import ConfigManager
from paser.core.event_monitor import EventMonitor
from prompt_toolkit.history import FileHistory
from rich.markdown import Markdown
from rich.panel import Panel

logger = setup_logger()

class ChatManager:
    def __init__(self, assistant, tools, system_instruction):
        self.assistant = assistant
        self.tools = tools
        self.system_instruction = system_instruction
        
        config_path = os.path.join(os.path.dirname(__file__), '..', 'config', 'config.json')
        self.config_manager = ConfigManager(config_path)
        
        self.thinking_enabled = self.config_manager.get("thinking_enabled", True)
        self.temperature = float(self.config_manager.get("default_temperature", 0.7))
        
        self.command_handler = CommandHandler(self)
        self.executor = AutonomousExecutor(
            self.assistant, self.tools,
            on_tool_used=self._on_tool_used,
            on_tool_start=self._on_tool_start,
            on_thought=self._on_thought
        )
        self.event_monitor = EventMonitor(event_manager, self.executor)
        self.should_exit = False
        
        self._initialized_event = threading.Event()
        self._init_error = None

    def _on_thought(self, thought_text):
        if not self.thinking_enabled: return
        console.print("[bold magenta]Thinking...[/bold magenta]")
        console.print(Markdown(thought_text), style="dim")

    def _get_tool_detail(self, tool_name, args):
        """Extracts a human-readable detail from tool arguments."""
        if not args:
            return ""
        
        # Priority keys for better feedback
        priority_keys = ['issue_number', 'path', 'url', 'query', 'symbol', 'repo', 'mensaje']
        for key in priority_keys:
            if key in args:
                val = args[key]
                # Shorten paths for cleaner UI
                if key == 'path' and isinstance(val, str):
                    val = os.path.basename(val) if len(val) > 30 else val
                return f": {val}"
        
        # Fallback to first argument
        first_val = next(iter(args.values())) if args else ""
        return f": {first_val}" if first_val else ""

    def _on_tool_start(self, tool_name, args):
        verb, icon = get_tool_metadata(tool_name)
        detail = self._get_tool_detail(tool_name, args)
        
        # Color dinámico según el tipo de herramienta
        from paser.core.tool_registry import FILE_TOOLS
        color = "yellow" if tool_name in FILE_TOOLS else "cyan"
        
        return SpinnerContext(f"{icon} {verb}{detail}...", color=color, newline=True)

    def _on_tool_used(self, tool_name, args, result, success):
        status_icon = "✓" if success else "✗"
        verb, icon = get_tool_metadata(tool_name)
        detail = self._get_tool_detail(tool_name, args)
        
        # Special case: if create_issue succeeded, use the issue number from the result
        if tool_name == 'create_issue' and success and isinstance(result, str):
            import re
            match = re.search(r'#(\d+)', result)
            if match:
                detail = f": #{match.group(1)}"

        # Diferenciación visual por tipo de herramienta
        from paser.core.tool_registry import FILE_TOOLS
        if tool_name in FILE_TOOLS:
            style = "bold yellow"
            prefix = "󰈚"
        else:
            style = "cyan"
            prefix = "󰍃"

        console.print(f"  {prefix} [bold]{style}{icon} {verb}{detail}[/bold] {status_icon}", style=style)

    async def run(self):
        loop = asyncio.get_running_loop()
        asyncio.create_task(asyncio.to_thread(self._initialize_chat))
        asyncio.create_task(self.event_monitor.monitor_loop(self.thinking_enabled))
        
        # Initialize Audio Toggle
        from paser.core.ui import audio_callback
        from paser.core.audio_manager import AudioManager
        
        self.audio_manager = AudioManager()
        self.is_recording = False
        
        # Definimos la función que se ejecutará al presionar 'v'
        def toggle_audio():
            if not self.is_recording:
                self.is_recording = True
                from paser.core.ui import ui_state, UIState
                ui_state.mode = UIState.AUDIO
                try:
                    self.audio_manager.start_recording()
                    console.print("\n[bold red]🎙️ Recording... (Press 'v' to stop)[/bold red]")
                except Exception as e:
                    console.print(f"Audio Error: {e}")
                    self.is_recording = False
                    ui_state.mode = UIState.NORMAL
            else:
                self.is_recording = False
                from paser.core.ui import ui_state, UIState
                ui_state.mode = UIState.NORMAL
                base64_audio = self.audio_manager.stop_recording()
                if base64_audio:
                    asyncio.create_task(self.handle_audio_input(base64_audio))

        # Asignamos el callback a la UI
        import paser.core.ui as ui_mod
        ui_mod.audio_callback = toggle_audio
        console.print("[bold green]🎙️ Voice Mode active (Press 'v' in NORMAL mode to toggle)[/bold green]")

        # Welcome Message (#115)
        model = self.config_manager.get("model_name", "Unknown")
        console.print(
            Panel(
                f"[bold cyan]🤖 Paser Autonomous Agent (Debug Mode)[/bold cyan]\n"
                f"[dim]Model: {model} | Temp: {self.temperature}[/dim]",
                title="🤖 System Ready",
                border_style="magenta",
                expand=False
            )
        )

        history = FileHistory(".chat_history")
        while not self.should_exit:
            try:
                user_input = await get_input("\u2502 \u279c ", history=history)
            except Exception as e:
                console.print(f"[bold red]Critical UI Error: {e}[/bold red]")
                break
            if not user_input: continue
            if await self.command_handler.handle(user_input): continue
            try:
                with SpinnerContext("", "cyan", newline=True):
                    result = await self.executor.execute(user_input=user_input, thinking_enabled=self.thinking_enabled, get_confirmation_callback=get_input)
                if result: print_model_response(re.sub(r'<[^>]+>.*?</[^>]+>', '', result, flags=re.DOTALL))
            except Exception as e: console.print(f"Error: {e}", style="red")

    def _initialize_chat(self):
        try:
            self.assistant.start_chat(self.config_manager.get("model_name", "models/gemma-2-27B-it"), self.system_instruction, self.temperature)
            self._initialized_event.set()
        except Exception as e: self._init_error = e

    async def handle_audio_input(self, base64_audio: str):
        """
        Procesa la entrada de audio proveniente del PTT Listener,
        integrándola en el ciclo de ejecución autónoma.
        """
        try:
            import base64
            import re
            audio_bytes = base64.b64decode(base64_audio)
            
            with SpinnerContext("Processing audio...", "magenta", newline=True):
                # Usamos el executor en lugar del asistente directamente para habilitar Tools y Thinking
                result = await self.executor.execute(
                    user_input=audio_bytes, 
                    thinking_enabled=self.thinking_enabled, 
                    get_confirmation_callback=get_input
                )
                
                if result:
                    # Limpiamos tags de herramientas del resultado final y formateamos con Rich
                    cleaned_result = re.sub(r'<[^>]+>.*?</[^>]+>', '', result, flags=re.DOTALL)
                    print_model_response(cleaned_result)
                else:
                    console.print("No se pudo obtener una respuesta del audio.", style="yellow")
        except Exception as e:
            console.print(f"Error processing audio: {e}", style="red")
