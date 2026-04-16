import json
import re
import os
import asyncio
import threading
from typing import Any, Optional, Union

from paser.core.logging import setup_logger
from paser.core.commands import CommandHandler
from paser.core.repetition_detector import RepetitionDetector
from paser.core.config_manager import ConfigManager
from paser.core.tool_parser import ToolParser
from paser.tools import ToolError

logger = setup_logger()

class ChatManager:
    def __init__(self, assistant, tools, system_instruction, ui):
        self.assistant = assistant
        self.tools = tools
        self.system_instruction = system_instruction
        self.ui = ui
        
        # Modularized Components
        self.config_manager = ConfigManager()
        self.tool_parser = ToolParser()
        
        self.thinking_enabled = self.config_manager.get("thinking_enabled", False)
        self.temperature = float(self.config_manager.get("default_temperature", 0.7))
        
        self.command_handler = CommandHandler(self)
        
        # Executor state
        self.repetition_detector = RepetitionDetector(n=5, max_repeats=5)
        self.max_turns = 100
        self.turn_count = 0
        self.stop_requested = False
        
        self.should_exit = False
        self._initialized_event = threading.Event()
        self._init_error = None

    def save_config(self, key, value):
        self.config_manager.save(key, value)

    def _extract_text(self, response) -> str:
        return response.text if hasattr(response, "text") and response.text else str(response)

    async def execute(self, user_input: Union[str, bytes], thinking_enabled: bool = True, get_confirmation_callback=None) -> str:
        self.stop_requested = False
        self.turn_count = 0
        self.turn_count += 1
        if self.turn_count > self.max_turns:
            return "Límite de turnos excedido."
        
        if isinstance(user_input, str):
            rep_res = self.repetition_detector.add_text(user_input)
            if rep_res is not True:
                return f"Detección de texto repetitivo: posible bucle infinito. Secuencia: '{rep_res}'"
        
        response = await asyncio.to_thread(self.assistant.send_message, user_input)
        response_text = self._extract_text(response)
        
        while True:
            if self.stop_requested:
                return "Ejecución interrumpida por el usuario."
            
            rep_res = self.repetition_detector.add_text(response_text)
            if rep_res is not True:
                return f"Detección de texto repetitivo: posible bucle infinito. Secuencia: '{rep_res}'"
            
            calls = self.tool_parser.extract_tool_calls(response_text)
            
            if not calls: break
            
            self.turn_count += 1
            if self.turn_count > self.max_turns: return "Límite de turnos excedido."
            
            combined_tool_responses = []
            for call_data, raw_content in calls:
                if call_data is None:
                    combined_tool_responses.append(self.tool_parser.format_tool_response(f"Error de sintaxis: {raw_content}", success=False))
                    continue
                
                name, args = call_data.get("name"), call_data.get("args", {})
                if name in self.tools:
                    try:
                        result = self.tools[name](**args)
                        tr = self.tool_parser.format_tool_response(result, call_id=call_data.get("id"), success=True)
                    except ToolError as te:
                        tr = self.tool_parser.format_tool_response(f"ERR: {str(te)}", call_id=call_data.get("id"), success=False)
                    except Exception as exc:
                        tr = self.tool_parser.format_tool_response(f"ERR: Unexpected error: {str(exc)}", call_id=call_data.get("id"), success=False)
                else:
                    tr = self.tool_parser.format_tool_response(f"Herramienta desconocida: {name}", call_id=call_data.get("id"), success=False)
                combined_tool_responses.append(tr)
            
            combined_message = "".join(combined_tool_responses)
            response_obj = await asyncio.to_thread(self.assistant.send_message, combined_message)
            response_text = self._extract_text(response_obj)
            
        return response_text

    async def execute_single(self, user_input: str) -> str:
        result = await self.execute(
            user_input=user_input, 
            thinking_enabled=self.thinking_enabled
        )
        return self.tool_parser.clean_response(result) if result else ""

    async def run(self, initial_input: Optional[str] = None):
        if not self._initialized_event.is_set():
            await asyncio.to_thread(self._initialize_chat)
        
        if initial_input:
            try:
                result = await self.execute(
                    user_input=initial_input, 
                    thinking_enabled=self.thinking_enabled, 
                    get_confirmation_callback=self.ui.request_input
                )
                if result:
                    cleaned_result = self.tool_parser.clean_response(result)
                    self.ui.display_message(cleaned_result)
                print("\n")
            except Exception as e:
                self.ui.display_error(f"Error processing initial message: {e}")
                print("\n")

        while not self.should_exit:
            try:
                user_input = await self.ui.request_input("> ", history=None)
            except Exception as e:
                self.ui.display_error(f"Critical UI Error: {e}")
                break
            if not user_input: continue
            if await self.command_handler.handle(user_input): continue
            try:
                result = await self.execute(
                    user_input=user_input, 
                    thinking_enabled=self.thinking_enabled, 
                    get_confirmation_callback=self.ui.request_input
                )
                if result:
                    cleaned_result = self.tool_parser.clean_response(result)
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
