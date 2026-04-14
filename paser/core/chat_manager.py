import json
import re
import os
import asyncio
import threading
import contextlib
import ast
from typing import Any, Optional, Union

from paser.core.logging import setup_logger
from paser.core.commands import CommandHandler
from paser.core.repetition_detector import RepetitionDetector
from paser.tools import ToolError

logger = setup_logger()

class ChatManager:
    def __init__(self, assistant, tools, system_instruction, ui):
        self.assistant = assistant
        self.tools = tools
        self.system_instruction = system_instruction
        self.ui = ui
        
        # Simplified Config Loading
        self.config_path = os.path.join(os.path.dirname(__file__), '..', 'config', 'config.json')
        self.config = self._load_config()
        
        self.thinking_enabled = self.config.get("thinking_enabled", False)
        self.temperature = float(self.config.get("default_temperature", 0.7))
        
        self.command_handler = CommandHandler(self)
        
        # Executor state integrated
        self.repetition_detector = RepetitionDetector(n=5, max_repeats=5)
        self.max_turns = 100
        self.turn_count = 0
        self.stop_requested = False
        
        self.should_exit = False
        self._initialized_event = threading.Event()
        self._init_error = None

    def _load_config(self) -> dict:
        try:
            if os.path.exists(self.config_path):
                with open(self.config_path, "r") as f:
                    return json.load(f)
        except Exception:
            pass
        return {}

    def save_config(self, key, value):
        self.config[key] = value
        try:
            with open(self.config_path, "w") as f:
                json.dump(self.config, f, indent=4)
        except Exception as e:
            logger.error(f"Error saving config: {e}")

    # --- Integrated Executor Logic ---
    def _parse_call_content(self, raw_content: str) -> Optional[dict[str, Any]]:
        try:
            data = json.loads(raw_content)
        except json.JSONDecodeError:
            try:
                data = ast.literal_eval(raw_content)
            except (ValueError, SyntaxError, TypeError):
                try:
                    s_double = raw_content.replace("'", '"')
                    data = json.loads(s_double)
                except json.JSONDecodeError:
                    return None
        if not isinstance(data, dict) or "name" not in data:
            return None
        if "args" not in data:
            data["args"] = {}
        return data

    def _extract_tool_calls(self, text: str) -> list[tuple[Optional[dict[str, Any]], str]]:
        calls = []
        md_pattern = r'```(?:json)?\s*(.*?)\s*```'
        for match in re.finditer(md_pattern, text, re.DOTALL):
            content = match.group(1).strip()
            data = self._parse_call_content(content)
            if data: calls.append((data, content))
        tag_pattern = r'<(?:TOOL_CALL|tool_call)\s*>(.*?)</(?:TOOL_CALL|tool_call)>'
        for match in re.finditer(tag_pattern, text, re.IGNORECASE | re.DOTALL):
            raw = match.group(1).strip()
            calls.append((self._parse_call_content(raw), raw))
        if not calls:
            json_pattern = r'\{(?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*\}'
            for match in re.finditer(json_pattern, text, re.DOTALL):
                raw = match.group(0).strip()
                data = self._parse_call_content(raw)
                if data and 'name' in data: calls.append((data, raw))
        return calls

    def _format_tool_response(self, data: Any, call_id: Optional[Union[int, str]] = None, success: bool = True) -> str:
        payload = {"id": call_id, "status": "success" if success else "error", "data": data}
        return f"<TOOL_RESPONSE>{json.dumps(payload)}</TOOL_RESPONSE>"

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
            
            calls = self._extract_tool_calls(response_text)
            
            if not calls: break
            
            self.turn_count += 1
            if self.turn_count > self.max_turns: return "Límite de turnos excedido."
            
            combined_tool_responses = []
            for call_data, raw_content in calls:
                if call_data is None:
                    combined_tool_responses.append(self._format_tool_response(f"Error de sintaxis: {raw_content}", success=False))
                    continue
                name, args = call_data.get("name"), call_data.get("args", {})
                if name in self.tools:
                    try:
                        result = self.tools[name](**args)
                        tr = self._format_tool_response(result, call_id=call_data.get("id"), success=True)
                    except ToolError as te:
                        tr = self._format_tool_response(f"ERR: {str(te)}", call_id=call_data.get("id"), success=False)
                    except Exception as exc:
                        tr = self._format_tool_response(f"ERR: Unexpected error: {str(exc)}", call_id=call_data.get("id"), success=False)
                else:
                    tr = self._format_tool_response(f"Herramienta desconocida: {name}", call_id=call_data.get("id"), success=False)
                combined_tool_responses.append(tr)
            
            combined_message = "".join(combined_tool_responses)
            response_obj = await asyncio.to_thread(self.assistant.send_message, combined_message)
            response_text = self._extract_text(response_obj)
            
        return response_text

    # --- Chat Manager Logic ---
    async def execute_single(self, user_input: str) -> str:
        result = await self.execute(
            user_input=user_input, 
            thinking_enabled=self.thinking_enabled
        )
        return re.sub(r'<[^>]+>.*?</[^>]+>', '', result, flags=re.DOTALL) if result else ""

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
                    cleaned_result = re.sub(r'<[^>]+>.*?</[^>]+>', '', result, flags=re.DOTALL)
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
                    cleaned_result = re.sub(r'<[^>]+>.*?</[^>]+>', '', result, flags=re.DOTALL)
                    self.ui.display_message(cleaned_result)
                
                print("\n")
            except Exception as e: 
                self.ui.display_error(f"Error: {e}")
                print("\n")

    def _initialize_chat(self):
        try:
            self.assistant.start_chat(self.config.get("model_name", "models/gemma-2-27B-it"), self.system_instruction, self.temperature)
            self._initialized_event.set()
        except Exception as e: self._init_error = e
