import json
import re
import os
import asyncio
import threading
import contextlib
from typing import Any, Optional

from paser.core.logging import setup_logger
from paser.core.commands import CommandHandler
from paser.core.executor import AutonomousExecutor
from paser.core.config_manager import ConfigManager
from prompt_toolkit.history import FileHistory

logger = setup_logger()

class ChatManager:
    def __init__(self, assistant, tools, system_instruction, ui):
        self.assistant = assistant
        self.tools = tools
        self.system_instruction = system_instruction
        self.ui = ui
        
        config_path = os.path.join(os.path.dirname(__file__), '..', 'config', 'config.json')
        self.config_manager = ConfigManager(config_path)
        
        self.thinking_enabled = self.config_manager.get("thinking_enabled", False)
        self.temperature = float(self.config_manager.get("default_temperature", 0.7))
        
        self.command_handler = CommandHandler(self)
        self.executor = AutonomousExecutor(
            self.assistant, self.tools
        )
        self.should_exit = False
        
        self._initialized_event = threading.Event()
        self._init_error = None

    async def execute_single(self, user_input: str) -> str:
        """Processes a single input and returns the result (one-shot mode)."""
        result = await self.executor.execute(
            user_input=user_input, 
            thinking_enabled=self.thinking_enabled
        )
        return re.sub(r'<[^>]+>.*?</[^>]+>', '', result, flags=re.DOTALL) if result else ""

    async def run(self):
        asyncio.create_task(asyncio.to_thread(self._initialize_chat))
        
        while not self.should_exit:
            try:
                user_input = await self.ui.request_input("> ", history=None)
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
                
                print("\n")
            except Exception as e: 
                self.ui.display_error(f"Error: {e}")
                print("\n")

    def _initialize_chat(self):
        try:
            self.assistant.start_chat(self.config_manager.get("model_name", "models/gemma-2-27B-it"), self.system_instruction, self.temperature)
            self._initialized_event.set()
        except Exception as e: self._init_error = e
