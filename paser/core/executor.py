import json
import re
import logging
import ast
import asyncio
from typing import Any, Optional, Union, get_type_hints, get_origin, get_args

from paser.core.repetition_detector import RepetitionDetector
from paser.core.interfaces import IAIAssistant
from paser.core.ui import async_get_confirmation
from paser.core.quota_tracker import QuotaTracker

logger = logging.getLogger(__name__)

class AutonomousExecutor:
    def __init__(self, assistant: IAIAssistant, tools: dict, on_tool_used=None, on_tool_start=None, on_thought=None, max_turns: int = 100):
        self.assistant = assistant
        self.tools = tools
        self.repetition_detector = RepetitionDetector(n=3, max_repeats=3)
        self.on_tool_used = on_tool_used
        self.on_tool_start = on_tool_start
        self.on_thought = on_thought
        self.max_turns = max_turns
        self.turn_count = 0
        self.stop_requested = False
        self.quota_tracker = QuotaTracker()

    def _parse_call_content(self, raw_content: str) -> Optional[dict[str, Any]]:
        """Intenta parsear el contenido de un TOOL_CALL usando múltiples estrategias."""
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

    def _format_tool_response(self, data: Any, success: bool = True) -> str:
        payload = {
            "status": "success" if success else "error",
            "turn": self.turn_count,
            "data": data
        }
        return f"<TOOL_RESPONSE>{json.dumps(payload)}</TOOL_RESPONSE>"

    async def execute(self, user_input: Union[str, bytes], thinking_enabled: bool = True, get_confirmation_callback=None) -> str:
        self.stop_requested = False
        self.turn_count = 0  # Reset turn count for the new task
        if self.stop_requested:
            return "Ejecución interrumpida por el usuario."

        self.turn_count += 1
        if self.turn_count > self.max_turns:
            return "Límite de turnos excedido: El agente ha alcanzado el máximo de iteraciones permitidas para evitar bucles infinitos."
            
        # Solo aplicamos detector de repetición si la entrada es texto
        if isinstance(user_input, str):
            rep_res = self.repetition_detector.add_text(user_input)
            if rep_res is not True:
                return f"Detección de texto repetitivo: posible bucle infinito. Secuencia: '{rep_res}'"

        self.quota_tracker.increment_and_get(self.assistant.current_model)
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

            if not calls:
                break
            
            self.turn_count += 1
            if self.turn_count > self.max_turns:
                return "Límite de turnos excedido."

            combined_tool_responses = []
            for call_data, raw_content in calls:
                if call_data is None:
                    tr = self._format_tool_response(f"Error de sintaxis: El TOOL_CALL '{raw_content}' no es un JSON válido.", success=False)
                    combined_tool_responses.append(tr)
                    continue

                name = call_data.get("name")
                args = call_data.get("args", {})
                
                if name in self.tools:
                    func = self.tools[name]
                    hints = get_type_hints(func)
                    for arg_name, arg_value in args.items():
                        if arg_name in hints:
                            expected_type = hints[arg_name]
                            origin = get_origin(expected_type)
                            is_valid = True
                            try:
                                if origin is Union:
                                    check_types = get_args(expected_type)
                                    is_valid = isinstance(arg_value, check_types)
                                elif origin is not None:
                                    is_valid = isinstance(arg_value, origin)
                                else:
                                    is_valid = isinstance(arg_value, expected_type)
                            except TypeError:
                                is_valid = True
                            
                            if not is_valid:
                                tr = self._format_tool_response(f"Tipo inválido para el argumento '{arg_name}' en '{name}'.", success=False)
                                combined_tool_responses.append(tr)
                                continue
                
                if not isinstance(args, dict):
                    tr = self._format_tool_response(f"Argumentos invñlidos para {name}", success=False)
                elif name not in self.tools:
                    tr = self._format_tool_response(f"Herramienta desconocida: {name}", success=False)
                else:
                    try:
                        # Confirmation removed for execute_python

                        ctx = None
                        if self.on_tool_start:
                            ctx = self.on_tool_start(name, args)
                        
                        if ctx:
                            with ctx:
                                result = self.tools[name](**args)
                        else:
                            result = self.tools[name](**args)
                        
                        tr = self._format_tool_response(result, success=True)
                        if self.on_tool_used:
                            self.on_tool_used(name, args, result, True)
                    except Exception as exc:
                        tr = self._format_tool_response(f"Error en herramienta '{name}': {str(exc)}", success=False)
                        if self.on_tool_used:
                            self.on_tool_used(name, args, str(exc), False)
                combined_tool_responses.append(tr)

            combined_message = "".join(combined_tool_responses)
            self.quota_tracker.increment_and_get(self.assistant.current_model)
            response_obj = await asyncio.to_thread(self.assistant.send_message, combined_message)
            response_text = self._extract_text(response_obj)

        return response_text

    def _extract_text(self, response) -> str:
        if hasattr(response, "text"):
            return response.text or ""
        return str(response)
