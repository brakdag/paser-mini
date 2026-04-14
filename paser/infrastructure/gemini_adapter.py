import logging
import re
import base64
import time
import json
import os
from typing import Generator, Optional, Any, Union
from google import genai
from google.genai import types
from google.genai.errors import ClientError

logger = logging.getLogger(__name__)

class GeminiAdapter:
    def __init__(self):
        self.client = genai.Client()
        self.chat: Any = None
        self.history: list = []
        self._current_model: Optional[str] = None
        self.max_retries = 5
        self.default_retry_delay = 5
        self.system_instruction: Optional[str] = None
        
        # Initialize call counter for langchain saving
        self.save_dir = "."
        self.call_count = self._initialize_call_count()
        self.save_langchain_enabled = False  # Default to False, enabled via /s

    def _initialize_call_count(self) -> int:
        """Finds the last used number in save_langchain to continue numbering."""
        if not os.path.exists(self.save_dir):
            return 0
        files = os.listdir(self.save_dir)
        numbers = []
        for f in files:
            match = re.search(r'lang_chang_(\d+)\.text', f)
            if match:
                numbers.append(int(match.group(1)))
        return max(numbers) if numbers else 0

    def _save_payload(self, current_message: Union[str, bytes]):
        """Saves the full prompt (system + history + current) to disk."""
        try:
            self.call_count += 1
            filename = f"lang_chang_{self.call_count}.text"
            filepath = os.path.join(self.save_dir, filename)
            
            lines = []
            lines.append("=== SYSTEM INSTRUCTION ===")
            lines.append(self.system_instruction or "No system instruction set.")
            lines.append("\n" + "="*30 + "\n")
            
            lines.append("=== CONVERSATION HISTORY ===")
            for content in self.history:
                role = content.role.upper()
                text_parts = []
                for part in content.parts:
                    if hasattr(part, 'text') and part.text:
                        text_parts.append(part.text)
                    elif hasattr(part, 'inline_data') or (hasattr(part, 'data') and part.data):
                        text_parts.append("[Binary Data/Image/Audio]")
                    else:
                        text_parts.append("[Unknown Part]")
                
                lines.append(f"[{role}]: " + "\n".join(text_parts))
                lines.append("-" * 20)
            
            lines.append("\n" + "="*30 + "\n")
            lines.append("=== CURRENT MESSAGE ===")
            if isinstance(current_message, bytes):
                lines.append("[Audio/Binary Data]")
            else:
                lines.append(current_message)

            # If the last message in history is from the model, append it as the response
            if self.history and self.history[-1].role.lower() == 'model':
                last_resp = self.history[-1]
                resp_text = " ".join([p.text for p in last_resp.parts if hasattr(p, 'text') and p.text])
                lines.append("\n" + "="*30 + "\n")
                lines.append("=== MODEL RESPONSE ===")
                lines.append(resp_text)
            
            with open(filepath, "w", encoding="utf-8") as f:
                f.write("\n".join(lines))
        except Exception as e:
            logger.error(f"Failed to save langchain payload: {e}")

    def save_snapshot(self):
        """Saves the last interaction to disk."""
        if not self.history:
            return False
        
        # Find the last user message to use as 'current_message'
        last_user_msg = None
        for content in reversed(self.history):
            if content.role.lower() == 'user':
                # Extract text from parts
                text_parts = [p.text for p in content.parts if hasattr(p, 'text') and p.text]
                last_user_msg = "\n".join(text_parts)
                break
        
        if last_user_msg:
            self._save_payload(last_user_msg)
            return True
        return False

    def _prepare_message_parts(self, message: str) -> list[types.Part]:
        """
        Convierte un mensaje de texto en una lista de partes multimodales.
        Si detecta un <TOOL_RESPONSE> con datos de imagen, lo convierte en un Part de imagen.
        """
        parts = []
        # Regex para encontrar bloques de TOOL_RESPONSE
        pattern = r'<(TOOL_RESPONSE)>(.*?)</\1>'
        last_pos = 0
        
        for match in re.finditer(pattern, message, re.DOTALL):
            # Agregar el texto antes del tag
            text_before = message[last_pos:match.start()]
            if text_before:
                parts.append(types.Part.from_text(text=text_before))
            
            # Procesar el contenido del TOOL_RESPONSE
            content = match.group(2).strip()
            try:
                data = json.loads(content)
                # Verificar si es una respuesta de imagen (tiene mime_type y data base64)
                if data.get("status") == "success" and isinstance(data.get("data"), dict) and "mime_type" in data["data"]:
                    img_data = data["data"]
                    parts.append(
                        types.Part.from_bytes(
                            data=base64.b64decode(img_data["data"]),
                            mime_type=img_data["mime_type"]
                        )
                    )
                else:
                    # Respuesta de herramienta normal, mantener como texto
                    parts.append(types.Part.from_text(text=match.group(0)))
            except json.JSONDecodeError:
                # Si no es JSON, mantener el tag como texto
                parts.append(types.Part.from_text(text=match.group(0)))
            
            last_pos = match.end()
        
        # Agregar el resto del texto
        text_after = message[last_pos:]
        if text_after:
            parts.append(types.Part.from_text(text=text_after))
            
        return parts

    def _is_retryable_error(self, e: Exception) -> bool:
        """Determina si un error es transitorio y amerita un reintento."""
        error_msg = str(e).lower()
        # Errores de cuota/TPM (429)
        if isinstance(e, ClientError) or getattr(e, 'status_code', None) == 429:
            return True
        if '429' in error_msg or 'quota' in error_msg or 'resource exhausted' in error_msg or 'tpm' in error_msg:
            return True
        # Errores de servidor (500, 503, 504)
        if getattr(e, 'status_code', None) in [500, 503, 504]:
            return True
        if any(code in error_msg for code in ['500', '503', '504']) or 'internal error' in error_msg or 'service unavailable' in error_msg:
            return True
        # Errores de red/conectividad
        if any(kw in error_msg for kw in ['connection', 'network', 'unreachable', 'timeout', 'dns', 'socket']):
            return True
        return False

    def _get_retry_delay(self, error: Exception, retries: int) -> float:
        """Extrae el retryDelay del error o calcula un backoff exponencial."""
        error_msg = str(error)
        try:
            # 1. Intento de parseo JSON rápido
            import json
            data = json.loads(error_msg)
            if isinstance(data, dict):
                # Búsqueda recursiva simple de retryDelay
                stack = [data]
                while stack:
                    curr = stack.pop()
                    if isinstance(curr, dict):
                        if 'retryDelay' in curr:
                            val = curr['retryDelay']
                            return float(str(val).rstrip('s'))
                        stack.extend(curr.values())
                    elif isinstance(curr, list):
                        stack.extend(curr)
        except Exception:
            pass

        try:
            # 2. Fallback: Regex robusto
            import re
            match = re.search(r'"retryDelay":\s*"?(\d+)(?:s)?"?', error_msg)
            if match:
                return float(match.group(1))
        except Exception:
            pass

        # 3. Backoff exponencial
        return self.default_retry_delay * (2 ** retries)

    def _format_api_error(self, e: Exception) -> str:
        """Formatea el error de la API para que sea más amable."""
        error_msg = str(e).lower()
        
        # Errores de Cuota (429)
        if isinstance(e, ClientError) or getattr(e, 'status_code', None) == 429 or '429' in error_msg or 'quota' in error_msg:
            delay = self._get_retry_delay(e, 0)
            return f"Cuota de API excedida (429). Por favor, espera {delay}s antes de intentar nuevamente."
        
        # Errores de Conectividad/DNS
        if any(kw in error_msg for kw in ['connection', 'network', 'unreachable', 'timeout', 'dns', 'socket', 'resolution']):
            return "Error de conectividad: No se pudo contactar con los servidores de Google. Verifica tu conexión a internet y DNS."
            
        # Errores de Servidor (500, 503)
        if any(code in error_msg for code in ['500', '503', 'internal error', 'unavailable']):
            return "El servidor de la API está experimentando problemas temporales (500/503). Reintentando..."
            
        return str(e)

    def start_chat(self, model_name: str, system_instruction: str, temperature: float):
        self._current_model = model_name
        self.system_instruction = system_instruction
        
        # Validar el modelo antes de iniciar
        try:
            available_models = self.get_available_models()
        except Exception as e:
            # Si get_available_models ya lanza ConnectionError, lo dejamos pasar
            if isinstance(e, ConnectionError):
                raise e
            raise ConnectionError(f"Error de conectividad al validar modelos: {e}")

        if model_name not in available_models:
            raise ValueError(f"Modelo no disponible: {model_name}. Use /models para ver los disponibles.")
        
        config_params: dict[str, Any] = {"temperature": temperature}
        self.history = []
        
        # Determinar si usar system_instruction en la config o en el historial
        if 'gemini' in model_name.lower():
            config_params["system_instruction"] = system_instruction
        else:
            self.history = [
                types.Content(
                    role="user",
                    parts=[types.Part.from_text(text=f"System Instructions: {system_instruction}")]
                ),
                types.Content(
                    role="model",
                    parts=[types.Part.from_text(text="Understood. I will follow these instructions.")]
                ),
            ]

        try:
            self.chat = self.client.chats.create(
                model=model_name,
                config=types.GenerateContentConfig(**config_params),
                history=self.history
            )
        except Exception as e:
            if self._is_retryable_error(e):
                raise ConnectionError(self._format_api_error(e))
            raise RuntimeError(f"Error al iniciar chat con el modelo {model_name}: {e}")

    def send_message_stream(self, message: str) -> Generator[str, None, None]:
        if not self.chat:
            yield ""
            return

        retries = 0
        while retries <= self.max_retries:
            try:
                # Convert string message to multimodal parts if necessary
                parts = self._prepare_message_parts(message)
                response = self.chat.send_message_stream(parts)
                full_text = ""
                for chunk in response:
                    if hasattr(chunk, 'text') and chunk.text:
                        full_text += chunk.text
                        yield chunk.text
                
                # Actualizar historial manualmente
                self.history.append(types.Content(role="user", parts=parts))
                self.history.append(types.Content(role="model", parts=[types.Part.from_text(text=full_text)]))
                return
            except Exception as e:
                if self._is_retryable_error(e):
                    retries += 1
                    if retries > self.max_retries:
                        formatted_error = self._format_api_error(e)
                        logger.error(f"API Error: Max retries reached. {formatted_error}")
                        yield f"\n⚠️ Error: {formatted_error}"
                        return
                    
                    delay = self._get_retry_delay(e, retries - 1)
                    # Log more discreetly for 429s
                    if isinstance(e, ClientError) or getattr(e, 'status_code', None) == 429 or '429' in str(e).lower():
                        logger.warning(f"API Retry {retries}/{self.max_retries} in {delay}s (Quota exceeded)")
                    else:
                        logger.warning(f"API Retry {retries}/{self.max_retries} in {delay}s due to: {e}")
                    
                    time.sleep(delay)
                    continue
                else:
                    logger.exception(f"Non-retryable API error: {e}")
                    raise e

    def send_message(self, message: Union[str, bytes]) -> Any:
        if not self.chat:
            return None

        retries = 0
        while retries <= self.max_retries:
            try:
                # Si el mensaje es bytes, lo tratamos como audio Base64
                if isinstance(message, bytes):
                    audio_bytes = message
                    parts = [types.Part.from_bytes(data=audio_bytes, mime_type="audio/wav")]
                else:
                    # Si es string, usamos la lógica de partes multimodales existente
                    parts = self._prepare_message_parts(message)
                
                response = self.chat.send_message(parts)
                
                # Actualizar historial
                self.history.append(types.Content(role="user", parts=parts))
                if hasattr(response, 'text') and response.text:
                    self.history.append(types.Content(role="model", parts=[types.Part.from_text(text=response.text)]))
                
                return response
            except Exception as e:
                if self._is_retryable_error(e):
                    retries += 1
                    if retries > self.max_retries:
                        formatted_error = self._format_api_error(e)
                        logger.error(f"API Error: Max retries reached. {formatted_error}")
                        return f"⚠️ Error: {formatted_error}"
                    
                    delay = self._get_retry_delay(e, retries - 1)
                    if isinstance(e, ClientError) or getattr(e, 'status_code', None) == 429 or '429' in str(e).lower():
                        logger.warning(f"API Retry {retries}/{self.max_retries} in {delay}s (Quota exceeded)")
                    else:
                        logger.warning(f"API Retry {retries}/{self.max_retries} in {delay}s due to: {e}")
                    
                    time.sleep(delay)
                    continue
                
                logger.exception(f"Non-retryable API error: {e}")
                raise e

    def send_audio_message(self, base64_audio: str) -> Any:
        """
        Envía un mensaje de audio codificado en Base64 a la API de Gemini.
        """
        if not self.chat:
            return None

        try:
            audio_bytes = base64.b64decode(base64_audio)
            # Crear la parte de audio (WAV es aceptado por Gemini)
            audio_part = types.Part.from_bytes(
                data=audio_bytes,
                mime_type="audio/wav"
            )
            
            response = self.chat.send_message([audio_part])
            
            # Actualizar historial
            self.history.append(types.Content(role="user", parts=[audio_part]))
            if hasattr(response, 'text') and response.text:
                self.history.append(types.Content(role="model", parts=[types.Part.from_text(text=response.text)]))
            
            return response
        except Exception as e:
            logger.exception(f"Error sending audio message: {e}")
            raise e

    def get_chat_history(self) -> Any:
        """Devuelve el objeto de historial bruto para el conteo de tokens."""
        return self.history if self.chat else None

    def get_history(self) -> list:
        if not self.chat:
            return []
        # Convertir objetos de historial a diccionarios serializables
        return [
            {"role": content.role, "parts": [part.text for part in content.parts if part.text]}
            for content in self.history
        ]

    def load_history(self, history_data: list, model_name: str, temperature: float):
        self._current_model = model_name
        self.history = [
            types.Content(role=item["role"], parts=[types.Part.from_text(text=text) for text in item["parts"]])
            for item in history_data
        ]
        
        self.chat = self.client.chats.create(
            model=model_name,
            config=types.GenerateContentConfig(temperature=temperature),
            history=self.history
        )

    def get_available_models(self) -> list:
        try:
            # Relaxed filtering to ensure models appear
            models = self.client.models.list()
            return [m.name for m in models if m.name and ('gemini' in m.name.lower() or 'gemma' in m.name.lower())]
        except Exception as e:
            if self._is_retryable_error(e):
                raise ConnectionError(self._format_api_error(e))
            raise e

    def count_tokens(self, contents: Any) -> int:
        """Cuenta los tokens de un contenido dado utilizando la API de Gemini."""
        if not self._current_model:
            return 0
        try:
            response = self.client.models.count_tokens(
                model=self._current_model,
                contents=contents
            )
            return response.total_tokens
        except Exception as e:
            error_msg = str(e).lower()
            if '404' in error_msg or 'not found' in error_msg:
                logger.warning(f"Model {self._current_model} not found for token counting. Returning 0.")
            else:
                logger.error(f"Error counting tokens: {e}")
            return 0
