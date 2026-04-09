import logging
import re
import base64
import time
import json
from typing import Generator, Optional, Any
from google import genai
from google.genai import types
from google.genai.errors import ClientError
from paser.core.interfaces import IAIAssistant

logger = logging.getLogger(__name__)

class GeminiAdapter(IAIAssistant):
    def __init__(self):
        self.client = genai.Client()
        self.chat: Any = None
        self.history: list = []
        self._current_model: Optional[str] = None
        self.max_retries = 5
        self.default_retry_delay = 5

    @property
    def current_model(self) -> Optional[str]:
        return self._current_model

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
        try:
            error_msg = str(error)
            # Intentamos parsear como JSON primero para una extracción más robusta
            try:
                import json
                data = json.loads(error_msg)
                def find_key(obj, key):
                    if isinstance(obj, dict):
                        if key in obj: return obj[key]
                        for v in obj.values():
                            res = find_key(v, key)
                            if res: return res
                    elif isinstance(obj, list):
                        for item in obj:
                            res = find_key(item, key)
                            if res: return res
                    return None
                
                delay_val = find_key(data, 'retryDelay')
                if delay_val is not None:
                    if isinstance(delay_val, str):
                        # Manejar formatos como "38s"
                        delay_val = delay_val.rstrip('s')
                    return float(delay_val)
            except Exception:
                pass

            # Fallback: Búsqueda con regex en el mensaje de error
            import re
            # Busca "retryDelay": "38s" o "retryDelay": 38
            match = re.search(r'"retryDelay":\s*"?(\d+)(?:s)?"?', error_msg)
            if match:
                return float(match.group(1))
        except Exception:
            pass
        # Backoff exponencial: default * (2 ^ retries)
        return self.default_retry_delay * (2 ** retries)

    def _format_api_error(self, e: Exception) -> str:
        """Formatea el error de la API para que sea más amable, especialmente para el 429."""
        error_msg = str(e).lower()
        if isinstance(e, ClientError) or getattr(e, 'status_code', None) == 429 or '429' in error_msg:
            delay = self._get_retry_delay(e, 0)
            return f"Cuota de API excedida. Por favor, espera {delay}s antes de intentar nuevamente."
        
        if any(kw in error_msg for kw in ['connection', 'network', 'unreachable', 'timeout', 'dns', 'socket']):
            return "No se ha detectado conexión a internet. Por favor, verifica tu red."
            
        return str(e)

    def start_chat(self, model_name: str, system_instruction: str, temperature: float):
        self._current_model = model_name
        
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

    def send_message(self, message: str) -> Any:
        if not self.chat:
            return None

        retries = 0
        while retries <= self.max_retries:
            try:
                # Convert string message to multimodal parts if necessary
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
                    # Log more discreetly for 429s
                    if isinstance(e, ClientError) or getattr(e, 'status_code', None) == 429 or '429' in str(e).lower():
                        logger.warning(f"API Retry {retries}/{self.max_retries} in {delay}s (Quota exceeded)")
                    else:
                        logger.warning(f"API Retry {retries}/{self.max_retries} in {delay}s due to: {e}")
                    
                    time.sleep(delay)
                    continue
                
                logger.exception(f"Non-retryable API error: {e}")
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
            logger.error(f"Error counting tokens: {e}")
            return 0
