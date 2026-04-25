import logging
import time
import base64
import os
import json
from typing import Generator, Optional, Any, Union, List
from .rest_client import GeminiRestClient
from . import errors
from .retry_handler import RetryHandler
from .snapshot_manager import SnapshotManager

logger = logging.getLogger(__name__)

class GeminiAdapter:
    def __init__(self):
        self.client = GeminiRestClient()
        self.history: List[dict] = []
        self._current_model: Optional[str] = None
        self.system_instruction: Optional[str] = None
        self.temperature: float = 0.7
        self.retry_handler = RetryHandler()
        self.snapshot_manager = SnapshotManager()

    def start_chat(self, model_name: str, system_instruction: str, temperature: float):
        self._current_model = model_name
        self.system_instruction = system_instruction
        self.temperature = temperature
        self.history = []

    def send_message_stream(self, message: str) -> Generator[str, None, None]:
        parts = [{"text": message}]
        self.history.append({"role": "user", "parts": parts})
        
        payload = {"contents": self.history, "generationConfig": {"temperature": self.temperature}}
        if self.system_instruction:
            payload["systemInstruction"] = {"parts": [{"text": self.system_instruction}]}

        full_text = ""
        try:
            for chunk in self.client.generate_content(self._current_model or "", payload, stream=True):
                full_text += chunk
                yield chunk
        except Exception as e:
            logger.error(f'Streaming error: {e}')
            yield f'Error: {str(e)}'
        
        self.history.append({"role": "model", "parts": [{"text": full_text}]})

    def send_message(self, message: Union[str, bytes]) -> Any:
        parts = [{"text": message}] if isinstance(message, str) else [{"inline_data": {"mime_type": "audio/wav", "data": base64.b64encode(message).decode()}}]
        self.history.append({"role": "user", "parts": parts})
        
        payload = {"contents": self.history, "generationConfig": {"temperature": self.temperature}}
        if self.system_instruction:
            payload["systemInstruction"] = {"parts": [{"text": self.system_instruction}]}

        try:
            response = self.retry_handler.execute(
                self.client.generate_content, 
                self._current_model or 'gemini-2.0-flash', 
                payload
            )
            
            if not response:
                logger.error('API returned empty response')
                return 'Error: API returned empty response'

            candidates = response.get('candidates', [])
            if not candidates:
                logger.warning(f'No candidates returned. Response: {response}')
                return 'Error: No response candidates returned (possible safety block).'

            candidate = candidates[0]
            finish_reason = candidate.get('finishReason')
            
            if finish_reason == 'SAFETY':
                logger.warning(f'Response blocked by safety filters. Response: {response}')
                return 'Error: Response blocked by safety filters.'

            content = candidate.get('content', {})
            parts = content.get('parts', [])
            if not parts:
                logger.warning(f'No parts in content. Response: {response}')
                return 'Error: No content parts returned.'

            text_content = "".join([p.get('text', '') for p in parts])
            if text_content:
                self.history.append({"role": "model", "parts": [{"text": text_content}]})
                return text_content
            return 'Error: Empty response'

        except Exception as e:
            logger.exception(f'Critical error in send_message: {e}')
            return f'Error: {str(e)}'

    def inject_message(self, role: str, content: str):
        self.history.append({"role": role, "parts": [{"text": content}]})

    def load_history(self, history_data: List[dict], model_name: str, temperature: float):
        self._current_model = model_name
        self.temperature = temperature
        self.history = history_data

    def get_available_models(self) -> List[str]:
        try:
            models = self.client.list_models()
            return [m['name'] for m in models if 'gemini' in m['name'] or 'gemma' in m['name']]
        except Exception as e:
            logger.error(f"Error fetching models: {e}")
            return ['gemini-2.0-flash', 'gemini-1.5-flash']

    def hard_reset(self, history_override: Optional[List[dict]] = None):
        self.history = history_override if history_override is not None else []

    def save_snapshot(self) -> bool:
        # El snapshot manager requiere el historial y la instrucción del sistema
        # Usamos el último mensaje del historial como referencia si existe
        last_msg = self.history[-1] if self.history else ""
        return self.snapshot_manager.save(self.system_instruction, self.history, last_msg)

    def get_history(self) -> List[dict]:
        return self.history

    def count_tokens(self, history: List[dict]) -> int:
        from src.infrastructure.gemini.utils import estimate_tokens
        return estimate_tokens(history)