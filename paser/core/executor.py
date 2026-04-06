import json
import re
import logging
import ast
from typing import Any, Optional, get_type_hints, get_origin, get_args

from paser.core.repetition_detector import RepetitionDetector
from paser.core.interfaces import IAIAssistant

logger = logging.getLogger(__name__)

class AutonomousExecutor:
    def __init__(self, assistant: IAIAssistant, tools: dict, on_tool_used=None):
        self.assistant = assistant
        self.tools = tools
        self.repetition_detector = RepetitionDetector(n=3, max_repeats=3)
        self.on_tool_used = on_tool_used

    def _parse_call_content(self, raw_content: str) -> Optional[dict[str, Any]]:
        """Intenta parsear el contenido de un TOOL_CALL usando múltiples estrategias."""
        # Estrategia 1: Intentar JSON directamente
        try:
            data = json.loads(raw_content)
        except json.JSONDecodeError:
            # Estrategia 2: Intentar evaluar como literal de Python (más seguro que reemplazar comillas)
            try:
                data = ast.literal_eval(raw_content)
            except (ValueError, SyntaxError, TypeError):
                # Estrategia 3: Intento desesperado de arreglar comillas (solo si las anteriores fallan)
                try:
                    s_double = raw_content.replace("'", '"')
                    data = json.loads(s_double)
                except json.JSONDecodeError:
                    return None
        
        if not isinstance(data, dict) or "name" not in data:
            return None
        
        # Asegurar que 'args' siempre exista para evitar errores de KeyError
        if "args" not in data:
            data["args"] = {}
            
        return data

    def _extract_tool_calls(self, text: str) -> list[tuple[Optional[dict[str, Any]], str]]:
        # Regex para capturar <TOOL_CALL> o <tool_call>, manejando espacios
        pattern = r"<(?:TOOL_CALL|tool_call)\s*>(.*?)</(?:TOOL_CALL|tool_call)>"
        calls: list[tuple[Optional[dict[str, Any]], str]] = []
        
        # 1. Capturar llamadas completas
        for match in re.finditer(pattern, text, re.IGNORECASE | re.DOTALL):
            raw = match.group(1).strip()
            data = self._parse_call_content(raw)
            calls.append((data, raw))
        
        # 2. Capturar llamada truncada al final (sin etiqueta de cierre)
        # Buscamos la última apertura de etiqueta
        all_opens = list(re.finditer(r"<(?:TOOL_CALL|tool_call)\s*>", text, re.IGNORECASE))
        if all_opens:
            last_open = all_opens[-1]
            remaining = text[last_open.end():].strip()
            # Si no hay etiqueta de cierre y el contenido comienza con '{', es probablemente una llamada truncada
            if not re.search(r"</(?:TOOL_CALL|tool_call)>", remaining, re.IGNORECASE) and remaining.startswith('{'):
                data = self._parse_call_content(remaining)
                calls.append((data, remaining))
                    
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
            for call_data, raw_content in calls:
                if call_data is None:
                    tr = self._format_tool_response(f"Error de sintaxis: El TOOL_CALL '{raw_content}' no es un JSON válido o está mal formado.", success=False)
                    combined_tool_responses.append(tr)
                    continue

                name = call_data.get("name")
                args = call_data.get("args", {})
                
                # Validación de tipos de argumentos basada en hints de la función
                if name in self.tools:
                    func = self.tools[name]
                    hints = get_type_hints(func)
                    for arg_name, arg_value in args.items():
                        if arg_name in hints:
                            expected_type = hints[arg_name]
                            # Manejar Optional o Union
                            origin = get_origin(expected_type)
                            if origin is not None:
                                expected_type = get_args(expected_type)[0]
                            
                            if not isinstance(arg_value, expected_type):
                                try:
                                    args[arg_name] = expected_type(arg_value)
                                except (ValueError, TypeError):
                                    tr = self._format_tool_response(f"Tipo inválido para el argumento '{arg_name}' en '{name}'. Se esperaba {expected_type.__name__}.", success=False)
                                    combined_tool_responses.append(tr)
                                    continue
                
                # Validación básica de argumentos
                if not isinstance(args, dict):
                    tr = self._format_tool_response(f"Argumentos inválidos para {name}", success=False)
                elif name not in self.tools:
                    tr = self._format_tool_response(f"Herramienta desconocida: {name}", success=False)
                else:
                    try:
                        result = self.tools[name](**args)
                        # Verificar si la herramienta realmente tuvo éxito o si devolvió un mensaje de error
                        is_error = isinstance(result, str) and (
                            "Error" in result or 
                            "failed" in result.lower() or 
                            "invalid" in result.lower()
                        )
                        tr = self._format_tool_response(result, success=not is_error)
                        if self.on_tool_used:
                            self.on_tool_used(name, args, result, not is_error)
                    except Exception as exc:
                        # Eliminamos logger.error para evitar fugas de detalles técnicos en la consola
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
            return response.text or ""
        return str(response)
