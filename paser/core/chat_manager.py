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
        priority_keys = ['path', 'url', 'query', 'symbol', 'repo', 'mensaje']
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
        return SpinnerContext(f"{icon} {verb}{detail}...", color="yellow", newline=True)

    def _on_tool_used(self, tool_name, args, result, success):
        status_icon = "✓" if success else "✗"
        verb, icon = get_tool_metadata(tool_name)
        detail = self._get_tool_detail(tool_name, args)
        console.print(f"  {icon} {verb}{detail} {status_icon}", style="dim yellow")

    async def run(self):
        asyncio.create_task(asyncio.to_thread(self._initialize_chat))
        asyncio.create_task(self.event_monitor.monitor_loop(self.thinking_enabled))
        
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
            except: break
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
