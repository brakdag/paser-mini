import json
import re
import logging
import ast
import asyncio
import contextlib
from typing import Any, Optional, Union, get_type_hints, get_origin, get_args

from paser.core.repetition_detector import RepetitionDetector
from paser.core.interfaces import IAIAssistant
from paser.tools import ToolError

logger = logging.getLogger(__name__)

class AutonomousExecutor:
    def __init__(self, assistant: IAIAssistant, tools: dict, on_tool_used=None, on_tool_start=None, on_thought=None, max_turns: int = 100):
        self.assistant = assistant
        self.tools = tools
        self.repetition_detector = RepetitionDetector(n=5, max_repeats=5)
        self.on_tool_used = on_tool_used
        self.on_tool_start = on_tool_start
        self.on_thought = on_thought
        self.max_turns = max_turns
        self.turn_count = 0
        self.stop_requested = False

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
            thought_match = re.split(r'<(?:TOOL_CALL|tool_call)\s*>', response_text, maxsplit=1, flags=re.IGNORECASE)
            thought_text = thought_match[0].strip()
            if thought_text and thinking_enabled and self.on_thought:
                self.on_thought(thought_text)
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
                        ctx = self.on_tool_start(name, args) if self.on_tool_start else None
                        with (ctx if ctx else contextlib.nullcontext()):
                            result = self.tools[name](**args)
                        tr = self._format_tool_response(result, call_id=call_data.get("id"), success=True)
                        if self.on_tool_used: self.on_tool_used(name, args, result, True)
                    except ToolError as te:
                        tr = self._format_tool_response(f"ERR: {str(te)}", call_id=call_data.get("id"), success=False)
                        if self.on_tool_used: self.on_tool_used(name, args, str(te), False)
                    except Exception as exc:
                        tr = self._format_tool_response(f"ERR: Unexpected error: {str(exc)}", call_id=call_data.get("id"), success=False)
                        if self.on_tool_used: self.on_tool_used(name, args, str(exc), False)
                else:
                    tr = self._format_tool_response(f"Herramienta desconocida: {name}", call_id=call_data.get("id"), success=False)
                combined_tool_responses.append(tr)
            combined_message = "".join(combined_tool_responses)
            response_obj = await asyncio.to_thread(self.assistant.send_message, combined_message)
            response_text = self._extract_text(response_obj)
        return response_text

    def _extract_text(self, response) -> str:
        return response.text if hasattr(response, "text") and response.text else str(response)
