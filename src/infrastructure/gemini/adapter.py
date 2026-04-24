import logging
import time
import base64
import os
import json
from typing import Generator, Optional, Any, Union
from google import genai
from google.genai import types
from google.genai.errors import ClientError

from . import errors
from . import utils
from . import history
from .retry_handler import RetryHandler
from .snapshot_manager import SnapshotManager

logger = logging.getLogger(__name__)

class GeminiAdapter:
    def __init__(self):
        self.client = genai.Client()
        self.chat: Any = None
        self.history: list = []
        self._current_model: Optional[str] = None
        self.system_instruction: Optional[str] = None
        self.temperature: float = 0.7
        
        # Modularized Components
        self.retry_handler = RetryHandler()
        self.snapshot_manager = SnapshotManager()
        self.save_langchain_enabled = False
        self._cache_path = os.path.join(os.path.dirname(__file__), '..', '..', 'config', 'model_cache.json')
        self._cached_tokens = 0

    def _get_cached_models(self) -> Optional[list]:
        """Retrieves available models from cache if it's fresh (less than 24h)."""
        try:
            if os.path.exists(self._cache_path):
                with open(self._cache_path, 'r') as f:
                    cache = json.load(f)
                    if time.time() - cache.get('timestamp', 0) < 86400:
                        return cache.get('models')
        except Exception as e:
            logger.warning(f"Error reading model cache: {e}")
        return None

    def _save_models_to_cache(self, models: list):
        """Saves available models to cache."""
        try:
            with open(self._cache_path, 'w') as f:
                json.dump({'timestamp': time.time(), 'models': models}, f)
        except Exception as e:
            logger.warning(f"Error saving model cache: {e}")

    def _update_token_cache(self):
        """Updates the cached token count for the current history."""
        if not self._current_model:
            return
        try:
            self._cached_tokens = utils.count_tokens(self.client, self._current_model, self.history)
        except Exception as e:
            logger.error(f"Error updating token cache: {e}")

    def save_snapshot(self):
        """Saves the last interaction to disk via SnapshotManager."""
        return self.snapshot_manager.save(
            system_instruction=self.system_instruction, 
            chat_history=self.history, 
            current_message=""
        )

    def start_chat(self, model_name: str, system_instruction: str, temperature: float):
        self._current_model = model_name
        self.system_instruction = system_instruction
        self.temperature = temperature
        
        try:
            # Try cache first
            available_models = self._get_cached_models()
            if available_models is None:
                available_models = self.get_available_models()
                self._save_models_to_cache(available_models)
        except Exception as e:
            if isinstance(e, ConnectionError):
                raise e
            raise ConnectionError(f"Error de conectividad al validar modelos: {e}")

        if model_name not in available_models:
            logger.warning(f"Modelo {model_name} no encontrado en Gemini. Usando modelo por defecto.")
            model_name = "models/gemini-2.0-flash"
        
        config_params: dict[str, Any] = {"temperature": temperature}
        self.history = []
        
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

        if model_name not in available_models:
            logger.warning(f"Modelo {model_name} no encontrado en Gemini. Usando modelo por defecto.")
            model_name = "models/gemini-2.0-flash"
        
        config_params: dict[str, Any] = {"temperature": temperature}
        self.history = []
        
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
            self._update_token_cache()
        except Exception as e:
            if errors.is_retryable_error(e):
                raise ConnectionError(errors.format_api_error(e, lambda err, ret: errors.get_retry_delay(err, ret, self.retry_handler.default_delay)))
            raise RuntimeError(f"Error al iniciar chat con el modelo {model_name}: {e}")

    def send_message_stream(self, message: str) -> Generator[str, None, None]:
        if not self.chat:
            yield ""
            return

        # Streaming requires a custom loop because it yields values
        retries = 0
        while True:
            try:
                parts = utils.prepare_message_parts(message)
                response = self.chat.send_message_stream(parts)
                full_text = ""
                for chunk in response:
                    if hasattr(chunk, 'text') and chunk.text:
                        full_text += chunk.text
                        yield chunk.text
                
                self.history.append(types.Content(role="user", parts=parts))
                self.history.append(types.Content(role="model", parts=[types.Part.from_text(text=full_text)]))
                self._update_token_cache()
                return
            except Exception as e:
                if not errors.is_retryable_error(e) or retries >= self.retry_handler.max_retries:
                    formatted_error = errors.format_api_error(e, lambda err, ret: errors.get_retry_delay(err, ret, self.retry_handler.default_delay))
                    logger.error(f"API Error: Max retries reached. {formatted_error}")
                    yield f"\n\u274c {formatted_error}"
                    return
                
                delay = errors.get_retry_delay(e, retries, self.retry_handler.default_delay)
                logger.warning(f"API Retry {retries + 1}/{self.retry_handler.max_retries} in {delay}s due to: {e}")
                time.sleep(delay)
                retries += 1

    def send_message(self, message: Union[str, bytes]) -> Any:
        if not self.chat:
            return None

        def _do_send():
            if isinstance(message, bytes):
                parts = [types.Part.from_bytes(data=message, mime_type="audio/wav")]
            else:
                parts = utils.prepare_message_parts(message)
            
            response = self.chat.send_message(parts)
            self.history.append(types.Content(role="user", parts=parts))
            if hasattr(response, 'text') and response.text:
                self.history.append(types.Content(role="model", parts=[types.Part.from_text(text=response.text)]))
            self._update_token_cache()
            return response

        try:
            return self.retry_handler.execute(_do_send)
        except Exception as e:
            formatted_error = errors.format_api_error(e, lambda err, ret: errors.get_retry_delay(err, ret, self.retry_handler.default_delay))
            return f"\u274c {formatted_error}"

    def send_audio_message(self, base64_audio: str) -> Any:
        if not self.chat:
            return None

        try:
            audio_bytes = base64.b64decode(base64_audio)
            return self.send_message(audio_bytes)
        except Exception as e:
            logger.exception(f"Error sending audio message: {e}")
            raise e

    def get_chat_history(self) -> Any:
        return self.history if self.chat else None

    def get_history(self) -> list:
        if not self.chat:
            return []
        return history.get_history_serializable(self.history)

    def load_history(self, history_data: list, model_name: str, temperature: float):
        self._current_model = model_name
        self.history = history.load_history_contents(history_data)
        
        self.chat = self.client.chats.create(
            model=model_name,
            config=types.GenerateContentConfig(temperature=temperature),
            history=self.history
        )
        self._update_token_cache()

    def get_available_models(self) -> list:
        try:
            return utils.get_available_models(self.client)
        except Exception as e:
            if errors.is_retryable_error(e):
                raise ConnectionError(errors.format_api_error(e, lambda err, ret: errors.get_retry_delay(err, ret, self.retry_handler.default_delay)))
            raise e

    def inject_message(self, role: str, content: str):
        """
        Injects a message directly into the history without sending it to the API.
        """
        self.history.append(types.Content(role=role, parts=[types.Part.from_text(text=content)]))
        self._update_token_cache()

    def check_availability(self, model_name: str) -> bool:
        """
        Checks if a model is actually available for the current account.
        """
        try:
            self.client.models.get(model=model_name)
            return True
        except Exception as e:
            if "404" in str(e).lower() or "not found" in str(e).lower():
                return False
            return True

    def refresh_session(self):
        """
        Destroys the current chat session and recreates it using the current history.
        This eliminates 'ghost states' in the SDK after history modification.
        """
        if not self._current_model:
            return
        
        config_params: dict[str, Any] = {"temperature": self.temperature}
        if 'gemini' in self._current_model.lower():
            config_params["system_instruction"] = self.system_instruction

        try:
            self.chat = self.client.chats.create(
                model=self._current_model,
                config=types.GenerateContentConfig(**config_params),
                history=self.history
            )
            self._update_token_cache()
            logger.info("Session refreshed successfully.")
        except Exception as e:
            logger.error(f"Error refreshing session: {e}")
            raise RuntimeError(f"Failed to refresh Gemini session: {e}")

    def count_tokens(self, contents: Any) -> int:
        if not self._current_model:
            return 0
        
        # Return cached value if counting the current history
        if contents is self.history:
            return self._cached_tokens

        try:
            return utils.count_tokens(self.client, self._current_model, contents)
        except Exception as e:
            error_msg = str(e).lower()
            if '404' in error_msg or 'not found' in error_msg:
                logger.warning(f"Model {self._current_model} not found for token counting. Returning 0.")
            else:
                logger.error(f"Error counting tokens: {e}")
            return 0
