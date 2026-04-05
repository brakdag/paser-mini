import json
import re
import logging
from typing import Any

from passer.core.repetition_detector import RepetitionDetector
from passer.core.interfaces import IAIAssistant

logger = logging.getLogger(__name__)

class AutonomousExecutor:
    def __init__(self, assistant: IAIAssistant, tools: dict, on_tool_used=None):
        self.assistant = assistant
        self.tools = tools
        self.repetition_detector = RepetitionDetector(n=3, max_repeats=3)
        self.on_tool_used = on_tool_used

    def _extract_tool_calls(self, text: str) -> list[dict[str, Any]]:
        # Regex mejorado para capturar JSON incluso si hay saltos de línea o texto alrededor
        pattern = r"<TOOL_CALL>\s*(.*?)\s*</TOOL_CALL>"
        matches = re.findall(pattern, text, re.DOTALL)
        calls: list[dict[str, Any]] = []
        for m in matches:
            try:
                # Limpiar y parsear JSON
                calls.append(json.loads(m.strip()))
            except json.JSONDecodeError as e:
                logger.error(f"Error parseando TOOL_CALL JSON: {e}, Content: {m}")
                continue
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
