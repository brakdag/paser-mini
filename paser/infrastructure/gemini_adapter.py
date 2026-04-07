from typing import Generator, Optional, Any
import time
import json
from google import genai
from google.genai import types
from google.genai.errors import ClientError
from paser.core.interfaces import IAIAssistant

class GeminiAdapter(IAIAssistant):
    def __init__(self):
        self.client = genai.Client()
        self.chat: Any = None
        self._current_model: Optional[str] = None
        self.max_retries = 5
        self.default_retry_delay = 5

    @property
    def current_model(self) -> Optional[str]:
        return self._current_model

    def _get_retry_delay(self, error: ClientError) -> float:
        """Extrae el retryDelay del error si está disponible, sino retorna el default."""
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
                
                delay = find_key(data, 'retryDelay')
                if delay is not None:
                    return float(delay)
            except Exception:
                pass

            # Fallback: Búsqueda con regex en el mensaje de error
            import re
            match = re.search(r'"retryDelay":\s*(\d+)', error_msg)
            if match:
                return float(match.group(1))
        except Exception:
            pass
        return self.default_retry_delay

    def start_chat(self, model_name: str, system_instruction: str, temperature: float):
        self._current_model = model_name
        
        # Validar el modelo antes de iniciar
        available_models = self.get_available_models()
        if model_name not in available_models:
            raise ValueError(f"Modelo no disponible: {model_name}. Use /models para ver los disponibles.")
        
        config_params = {"temperature": temperature}
        history = []
        
        # Determinar si usar system_instruction en la config o en el historial
        if 'gemini' in model_name.lower():
            config_params["system_instruction"] = system_instruction
        else:
            history = [
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
                history=history
            )
        except ClientError as e:
            raise RuntimeError(f"Error al iniciar chat con el modelo {model_name}: {e}")

    def send_message_stream(self, message: str) -> Generator[str, None, None]:
        if not self.chat:
            yield ""
            return

        retries = 0
        while retries <= self.max_retries:
            try:
                response = self.chat.send_message_stream(message)
                for chunk in response:
                    if hasattr(chunk, 'text') and chunk.text:
                        yield chunk.text
                return # Éxito, salimos del loop
            except Exception as e:
                # Capturamos Exception general para analizar si es un error de cuota/TPM
                error_msg = str(e)
                is_quota_error = (
                    isinstance(e, ClientError) or 
                    getattr(e, 'status_code', None) == 429 or 
                    '429' in error_msg or 
                    'quota' in error_msg.lower() or 
                    'resource exhausted' in error_msg.lower() or
                    'tpm' in error_msg.lower()
                )

                if is_quota_error:
                    retries += 1
                    if retries > self.max_retries:
                        yield f"\n⚠️ Error: Cuota de API excedida tras {self.max_retries} reintentos. {e}"
                        return
                    
                    delay = self._get_retry_delay(e)
                    time.sleep(delay)
                    continue
                else:
                    raise e

    def send_message(self, message: str) -> Any:
        if not self.chat:
            return None

        retries = 0
        while retries <= self.max_retries:
            try:
                return self.chat.send_message(message)
            except Exception as e:
                error_msg = str(e)
                is_quota_error = (
                    isinstance(e, ClientError) or 
                    getattr(e, 'status_code', None) == 429 or 
                    '429' in error_msg or 
                    'quota' in error_msg.lower() or 
                    'resource exhausted' in error_msg.lower() or
                    'tpm' in error_msg.lower()
                )

                if is_quota_error:
                    retries += 1
                    if retries > self.max_retries:
                        return f"⚠️ Error: Cuota de API excedida tras {self.max_retries} reintentos. {e}"
                    
                    delay = self._get_retry_delay(e)
                    time.sleep(delay)
                    continue
                raise e

    def get_history(self) -> list:
        if not self.chat:
            return []
        # Convertir objetos de historial a diccionarios serializables
        return [
            {"role": content.role, "parts": [part.text for part in content.parts if part.text]}
            for content in self.chat.history
        ]

    def load_history(self, history_data: list, model_name: str, temperature: float):
        self._current_model = model_name
        history = [
            types.Content(role=item["role"], parts=[types.Part.from_text(text=text) for text in item["parts"]])
            for item in history_data
        ]
        
        self.chat = self.client.chats.create(
            model=model_name,
            config=types.GenerateContentConfig(temperature=temperature),
            history=history
        )

    def get_available_models(self) -> list:
        # Relaxed filtering to ensure models appear
        models = self.client.models.list()
        return [m.name for m in models if m.name and ('gemini' in m.name.lower() or 'gemma' in m.name.lower())]
