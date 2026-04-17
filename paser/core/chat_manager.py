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

class EmergencyStopException(Exception):
    """Exception raised when the user triggers the emergency stop (Esc key)."""
    pass

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
        self.context_window_limit = int(self.config_manager.get("context_window_limit", 250000))
        self.rpm_limit = int(self.config_manager.get("rpm_limit", 15))
        self.request_timestamps = []
        
        self.command_handler = CommandHandler(self, ui)
        
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

    async def _wait_for_rate_limit(self):
        now = asyncio.get_event_loop().time()
        self.request_timestamps = [t for t in self.request_timestamps if now - t < 60]
        
        if len(self.request_timestamps) >= self.rpm_limit:
            wait_time = 60 - (now - self.request_timestamps[0])
            if wait_time > 0:
                logger.warning(f"Rate limit reached. Waiting {wait_time:.2f}s...")
                await asyncio.sleep(wait_time)
                return await self._wait_for_rate_limit()
        
        self.request_timestamps.append(asyncio.get_event_loop().time())

    async def _enforce_context_limit(self):
        history = self.assistant.history
        if not history:
            return

        start_idx = 0
        if 'gemini' not in (self.assistant._current_model or '').lower():
            start_idx = 2

        while len(history) > start_idx and self.assistant.count_tokens(history) > self.context_window_limit:
            if len(history) > start_idx + 1:
                del history[start_idx : start_idx + 2]
            else:
                del history[start_idx]

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
        
        try:
            await self._wait_for_rate_limit()
            await self._enforce_context_limit()
            response = await asyncio.to_thread(self.assistant.send_message, user_input)
            response_text = self._extract_text(response)
            
            while True:
                if self.stop_requested:
                    raise EmergencyStopException("Ejecución interrumpida por el usuario.")
                
                rep_res = self.repetition_detector.add_text(response_text)
                if rep_res is not True:
                    return f"Detección de texto repetitivo: posible bucle infinito. Secuencia: '{rep_res}'"
                
                calls = self.tool_parser.extract_tool_calls(response_text)
                
                if not calls: break
                
                self.turn_count += 1
                if self.turn_count > self.max_turns: return "Límite de turnos excedido."
                
                combined_tool_responses = []
                for call_data, raw_content in calls:
                    if self.stop_requested:
                        raise EmergencyStopException("Ejecución interrumpida por el usuario.")

                    if call_data is None:
                        combined_tool_responses.append(self.tool_parser.format_tool_response(f"Error de sintaxis: {raw_content}", success=False))
                        continue
                    
                    name, args = call_data.get("name"), call_data.get("args", {})
                    
                    # Extract detail for monitoring
                    detail = ""
                    if name in ["read_file", "write_file", "remove_file", "replace_string"]:
                        path = args.get("path", "")
                        detail = os.path.basename(path) if path else ""
                    elif name in ["list_dir", "create_dir"]:
                        detail = args.get("path", "")
                    elif name == "rename_path":
                        orig = os.path.basename(args.get("origen", ""))
                        dest = os.path.basename(args.get("destino", ""))
                        detail = f"{orig} -> {dest}"
                    
                    self.ui.start_tool_monitoring(name, detail)
                    
                    # Yield to the event loop to allow the spinner to render its first frame
                    await asyncio.sleep(0)
                    
                    start_time = asyncio.get_event_loop().time()
                    
                    if name in self.tools:
                        try:
                            # Execute tool in a thread to prevent blocking the spinner animation
                            result = await asyncio.to_thread(self.tools[name], **args)
                            
                            # Visualización especial para la instancia de prueba
                            if name == "run_instance":
                                self.ui.display_message(f"**🚀 Instance Test Output**\n\n```text\n{result}\n```")
                            
                            tr = self.tool_parser.format_tool_response(result, call_id=call_data.get("id"), success=True)
                            success = True
                        except ToolError as te:
                            tr = self.tool_parser.format_tool_response(f"ERR: {str(te)}", call_id=call_data.get("id"), success=False)
                            success = False
                        except Exception as exc:
                            tr = self.tool_parser.format_tool_response(f"ERR: Unexpected error: {str(exc)}", call_id=call_data.get("id"), success=False)
                            success = False
                    else:
                        tr = self.tool_parser.format_tool_response(f"Herramienta desconocida: {name}", call_id=call_data.get("id"), success=False)
                        success = False
                    
                    # Ensure the spinner is visible for at least 300ms for better UX
                    elapsed = asyncio.get_event_loop().time() - start_time
                    if elapsed < 0.3:
                        await asyncio.sleep(0.3 - elapsed)
                    
                    self.ui.end_tool_monitoring(name, success=success, detail=detail)
                    combined_tool_responses.append(tr)
                
                combined_message = "".join(combined_tool_responses)
                await self._wait_for_rate_limit()
                await self._enforce_context_limit()
                response_obj = await asyncio.to_thread(self.assistant.send_message, combined_message)
                response_text = self._extract_text(response_obj)
                
            return response_text
        finally:
            self.ui.stop_all_monitoring()

    async def execute_single(self, user_input: str) -> str:
        result = await self.execute(
            user_input=user_input, 
            thinking_enabled=self.thinking_enabled
        )
        return self.tool_parser.clean_response(result) if result else ""

    async def run(self, initial_input: Optional[str] = None):
        if not self._initialized_event.is_set():
            await asyncio.to_thread(self._initialize_chat)
        
        current_intervention = None

        if initial_input:
            try:
                result = await self.execute(
                    user_input=initial_input, 
                    thinking_enabled=self.thinking_enabled, 
                    get_confirmation_callback=self.ui.request_input
                )
                if result:
                    cleaned_result = self.tool_parser.clean_response(result)
                    self.ui.add_spacing()
                    self.ui.display_message(cleaned_result)
                self.ui.add_spacing()
            except EmergencyStopException:
                self.ui.display_emergency_stop()
                current_intervention = await self.ui.request_input("> ")
            except Exception as e:
                self.ui.display_error(f"Error processing initial message: {e}")
                self.ui.add_spacing()

        while not self.should_exit:
            try:
                if current_intervention:
                    user_input = current_intervention
                    current_intervention = None
                else:
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
                    self.ui.add_spacing()
                    self.ui.display_message(cleaned_result)
                
                self.ui.add_spacing()
            except EmergencyStopException:
                self.ui.display_emergency_stop()
                current_intervention = await self.ui.request_input("> ")
            except Exception as e: 
                self.ui.display_error(f"Error: {e}")
                self.ui.add_spacing()

    def _initialize_chat(self):
        try:
            self.assistant.start_chat(self.config_manager.get("model_name", "models/gemma-4-31b-it"), self.system_instruction, self.temperature)
            self._initialized_event.set()
        except Exception as e: self._init_error = e
