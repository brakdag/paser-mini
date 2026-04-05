import json
import re
import logging
import ast
from typing import Any

from paser.core.repetition_detector import RepetitionDetector
from paser.core.interfaces import IAIAssistant

logger = logging.getLogger(__name__)

class AutonomousExecutor:
    def __init__(self, assistant: IAIAssistant, tools: dict, on_tool_used=None):
        self.assistant = assistant
        self.tools = tools
        self.repetition_detector = RepetitionDetector(n=3, max_repeats=3)
        self.on_tool_used = on_tool_used

    def _extract_tool_calls(self, text: str) -> list[dict[str, Any]]:
        # Regex para capturar <TOOL_CALL> o <tool_call>, manejando espacios
        pattern = r"<(?:TOOL_CALL|tool_call)\s*>(.*?)</(?:TOOL_CALL|tool_call)>"
        calls: list[dict[str, Any]] = []
        
        for match in re.finditer(pattern, text, re.IGNORECASE | re.DOTALL):
            raw_content = match.group(1).strip()
            
            # Intentar cargar como JSON estándar
            try:
                data = json.loads(raw_content)
            except json.JSONDecodeError:
                # Fallback: intentar convertir comillas simples a dobles para JSON
                try:
                    s_double = raw_content.replace("'", '"')
                    data = json.loads(s_double)
                except json.JSONDecodeError:
                    # Fallback extra: intentar evaluar como literal de Python (maneja single quotes)
                    try:
                        data = ast.literal_eval(raw_content)
                    except (ValueError, SyntaxError, TypeError):
                        logger.error(f"No se pudo parsear el TOOL_CALL: {raw_content}")
                        continue
            
            # Validación de estructura básica: 'name' y 'args' deben estar presentes
            if not isinstance(data, dict) or "name" not in data or "args" not in data:
                logger.error(f"Estructura de TOOL_CALL inválida. Se requiere 'name' y 'args'. Contenido: {raw_content}")
                continue
                
            calls.append(data)
                
        return calls

    def _format_tool_response(self, data: Any, success: bool = True) -> str:
        payload = {"status": "success" if success else "error", "data": data}
        return f"<TOOL_RESPONSE>{json.dumps(payload)}</TOOL_RESPONSE>"

    def execute(self, user_input: str, thinking_enabled: bool = True, get_confirmation_callback=None) -> str:
        if not self.repetition_detector.add_text(user_input):
            return "Detección de texto repetitivo: posible bucle infinito."

        if thinking_enabled:
            response = self.assistant.send_message(user_input)
            response_text = self._extract_text(response)
        else:
            response_text = user_input

        while True:
            if not self.repetition_detector.add_text(response_text):
                return "Detección de texto repetitivo: posible bucle infinito."

            calls = self._extract_tool_calls(response_text)
            if not calls:
                break

            combined_tool_responses = []
            for call in calls:
                name = call.get("name")
                args = call.get("args", {})
                
                # Validación básica de argumentos
                if not isinstance(args, dict):
                    tr = self._format_tool_response(f"Argumentos inválidos para {name}", success=False)
                elif name not in self.tools:
                    tr = self._format_tool_response(f"Herramienta desconocida: {name}", success=False)
                else:
                    try:
                        result = self.tools[name](**args)
                        tr = self._format_tool_response(result, success=True)
                        if self.on_tool_used:
                            self.on_tool_used(name, args, result, True)
                    except Exception as exc:
                        logger.error(f"Error ejecutando {name}: {exc}")
                        tr = self._format_tool_response(str(exc), success=False)
                        if self.on_tool_used:
                            self.on_tool_used(name, args, str(exc), False)
                combined_tool_responses.append(tr)

            combined_message = "".join(combined_tool_responses)
            response_obj = self.assistant.send_message(combined_message)
            response_text = self._extract_text(response_obj)

        return response_text

    def _extract_text(self, response) -> str:
        if hasattr(response, "text"):
            return response.text
        return str(response)
