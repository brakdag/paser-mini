import json
import re
import os
import asyncio
import threading
import contextlib
from typing import Any, Optional

from paser.core.logging import setup_logger
from paser.core.ui_interface import UserInterface
from paser.core.commands import CommandHandler
from paser.core.executor import AutonomousExecutor
from paser.core.event_manager import event_manager
from paser.core.tool_registry import get_tool_metadata
from paser.core.config_manager import ConfigManager
from paser.core.event_monitor import EventMonitor
from prompt_toolkit.history import FileHistory

logger = setup_logger()

class ChatManager:
    def __init__(self, assistant, tools, system_instruction, ui: UserInterface):
        self.assistant = assistant
        self.tools = tools
        self.system_instruction = system_instruction
        self.ui = ui
        
        config_path = os.path.join(os.path.dirname(__file__), '..', 'config', 'config.json')
        self.config_manager = ConfigManager(config_path)
        
        # Pensamientos desactivados por defecto
        self.thinking_enabled = self.config_manager.get("thinking_enabled", False)
        self.temperature = float(self.config_manager.get("default_temperature", 0.7))
        
        self.command_handler = CommandHandler(self)
        self.executor = AutonomousExecutor(
            self.assistant, self.tools,
            on_tool_used=self._on_tool_used,
            on_tool_start=self._on_tool_start
            # on_thought eliminado para no procesar pensamientos
        )
        self.event_monitor = EventMonitor(event_manager, self.executor)
        self.should_exit = False
        
        self._initialized_event = threading.Event()
        self._init_error = None

    def _get_tool_detail(self, tool_name, args):
        """Extracts a highly representative human-readable detail from tool arguments."""
        if not args:
            return ""
        
        if tool_name == 'rename_path':
            orig = os.path.basename(args.get('origen', 'unknown'))
            dest = os.path.basename(args.get('destino', 'unknown'))
            return f": {orig} \u2192 {dest}"

        path_keys = ['path', 'filepath', 'origen', 'destino', 'input_path']
        for pk in path_keys:
            if pk in args and isinstance(args[pk], str):
                return f": {os.path.basename(args[pk])}"

        priority_keys = ['query', 'url', 'symbol', 'repo', 'mensaje', 'issue_number']
        for key in priority_keys:
            if key in args:
                val = str(args[key])
                if len(val) > 40:
                    val = val[:37] + "..."
                return f": {val}"
        
        try:
            first_val = str(next(iter(args.values())))
            if len(first_val) > 40:
                first_val = first_val[:37] + "..."
            return f": {first_val}"
        except StopIteration:
            return ""

    def _on_tool_start(self, tool_name, args):
        detail = self._get_tool_detail(tool_name, args)
        return self.ui.get_spinner(f"{tool_name}{detail}...", color="#cba6f7", newline=False)

    def _on_tool_used(self, tool_name, args, result, success):
        detail = self._get_tool_detail(tool_name, args)
        self.ui.display_tool_status(tool_name, success, detail)

    async def run(self):
        loop = asyncio.get_running_loop()
        asyncio.create_task(asyncio.to_thread(self._initialize_chat))
        asyncio.create_task(self.event_monitor.monitor_loop(self.thinking_enabled))
        
        model = self.config_manager.get("model_name", "Unknown")
        self.ui.display_panel(
            title="🤖 System Ready",
            message=f"[bold cyan]🤖 Paser Mini Autonomous Agent[/bold cyan]\n"
                    f"[dim]Model: {model} | Temp: {self.temperature}[/dim]",
            style="magenta"
        )

        history = FileHistory(".chat_history")
        while not self.should_exit:
            try:
                user_input = await self.ui.request_input("\u2502 \u279c ", history=history)
            except Exception as e:
                self.ui.display_error(f"Critical UI Error: {e}")
                break
            if not user_input: continue
            if await self.command_handler.handle(user_input): continue
            try:
                spinner = self.ui.get_spinner("", "#b4befe", newline=True)
                with (spinner if spinner is not None else contextlib.nullcontext()):
                    result = await self.executor.execute(
                        user_input=user_input, 
                        thinking_enabled=self.thinking_enabled, 
                        get_confirmation_callback=self.ui.request_input
                    )
                if result:
                    cleaned_result = re.sub(r'<[^>]+>.*?</[^>]+>', '', result, flags=re.DOTALL)
                    self.ui.display_message(cleaned_result)
            except Exception as e: 
                self.ui.display_error(f"Error: {e}")

    def _initialize_chat(self):
        try:
            self.assistant.start_chat(self.config_manager.get("model_name", "models/gemma-2-27B-it"), self.system_instruction, self.temperature)
            self._initialized_event.set()
        except Exception as e: self._init_error = e
