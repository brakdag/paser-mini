import json
import re
import os
import asyncio
import threading
from paser.core.logging import setup_logger
from paser.core.ui import console, get_input, print_model_response, SpinnerContext
from paser.core.commands import CommandHandler
from paser.core.executor import AutonomousExecutor
from paser.core.interfaces import IAIAssistant
from paser.core.event_manager import event_manager
from paser.core.tool_registry import get_tool_metadata, FILE_TOOLS
from prompt_toolkit.history import FileHistory
from rich.markdown import Markdown

logger = setup_logger()

class ChatManager:
    def __init__(self, assistant, tools, system_instruction):
        self.assistant = assistant
        self.tools = tools
        self.system_instruction = system_instruction
        self.config = self._load_config()
        self.thinking_enabled = self.config.get("thinking_enabled", True)
        self.temperature = float(self.config.get("default_temperature", 0.7))
        self.command_handler = CommandHandler(self)
        self.event_manager = event_manager
        self.executor = AutonomousExecutor(
            self.assistant, self.tools,
            on_tool_used=self._on_tool_used,
            on_tool_start=self._on_tool_start,
            on_thought=self._on_thought
        )
        self._initialized_event = threading.Event()
        self._init_error = None

    def _load_config(self):
        try:
            with open(os.path.join(os.path.dirname(__file__), '..', 'config', 'config.json'), "r") as f:
                return json.load(f)
        except: return {}

    def _on_thought(self, thought_text):
        if not self.thinking_enabled: return
        console.print("[bold magenta]Thinking...[/bold magenta]")
        console.print(Markdown(thought_text), style="dim")

    def _on_tool_start(self, tool_name, args):
        verb, icon = get_tool_metadata(tool_name)
        return SpinnerContext(f"{icon} {verb}...", color="yellow", newline=True)

    def _on_tool_used(self, tool_name, args, result, success):
        status_icon = "✓" if success else "✗"
        verb, icon = get_tool_metadata(tool_name)
        console.print(f"  {icon} {verb} {status_icon}", style="dim yellow")

    async def _event_monitor_loop(self):
        while True:
            try:
                for msg in event_manager.check_expired_events():
                    console.print(f"\n[EVENTO] {msg}", style="bold magenta")
                    res = await self.executor.execute(user_input=f"[SISTEMA: {msg} ha expirado]", thinking_enabled=self.thinking_enabled, get_confirmation_callback=get_input)
                    if res: print_model_response(re.sub(r'<[^>]+>.*?</[^>]+>', '', res, flags=re.DOTALL))
                await asyncio.sleep(1)
            except: await asyncio.sleep(10)

    async def run(self):
        asyncio.create_task(asyncio.to_thread(self._initialize_chat))
        asyncio.create_task(self._event_monitor_loop())
        history = FileHistory(".chat_history")
        while True:
            try:
                user_input = await get_input("│ ➜ ", history=history)
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
            self.assistant.start_chat(self.config.get("model_name", "models/gemma-2-27B-it"), self.system_instruction, self.temperature)
            self._initialized_event.set()
        except Exception as e: self._init_error = e