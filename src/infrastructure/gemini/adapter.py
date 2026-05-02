import logging
import asyncio
import base64
import os
import json
from typing import AsyncGenerator, Optional, Any, Union, List, Callable, Dict
from .rest_client import GeminiRestClient
from . import errors
from .retry_handler import RetryHandler
from .snapshot_manager import SnapshotManager
from src.infrastructure.gemini.utils import estimate_tokens

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

    def set_retry_callback(self, callback: Callable[[str], None]):
        self.retry_handler.on_retry = callback

    def start_chat(self, model_name: str, system_instruction: str, temperature: float):
        self._current_model = model_name
        self.system_instruction = system_instruction
        self.temperature = temperature
        self.history = []

    def _build_payload(self) -> Dict[str, Any]:
        contents = list(self.history)
        payload = {"contents": contents, "generationConfig": {"temperature": self.temperature}}

        if self.system_instruction:
            if self._current_model and "gemma-3" in self._current_model.lower():
                if contents:
                    first_msg = contents[0]
                    if first_msg["role"] == "user":
                        first_msg["parts"][0]["text"] = f"{self.system_instruction}\n\n{first_msg['parts'][0]['text']}"
                else:
                    payload["contents"].append({"role": "user", "parts": [{"text": self.system_instruction}]})
            else:
                payload["systemInstruction"] = {"parts": [{"text": self.system_instruction}]}
        
        return payload

    async def send_message_stream(self, message: str, role: str = "user") -> AsyncGenerator[str, None]:
        parts = [{"text": message}]
        self.history.append({"role": role, "parts": parts})
        
        payload = self._build_payload()
        full_text = ""
        try:
            # Await the async generator from the client
            async for chunk in await self.client.generate_content(self._current_model or "", payload, stream=True):
                full_text += chunk
                yield chunk
        except Exception as e:
            logger.error(f'Streaming error: {e}')
            yield f'Error: {str(e)}'
        
        self.history.append({"role": "model", "parts": [{"text": full_text}]})

    async def send_message(self, message: Union[str, bytes], role: str = "user") -> Any:
        parts = [{"text": message}] if isinstance(message, str) else [{"inline_data": {"mime_type": "audio/wav", "data": base64.b64encode(message).decode()}}]
        self.history.append({"role": role, "parts": parts})
        
        payload = self._build_payload()

        try:
            # Await the async retry handler
            response = await self.retry_handler.execute(
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

    async def get_available_models(self) -> List[str]:
        try:
            # Await the async client call
            models = await self.client.list_models()
            return [m['name'] for m in models if 'gemini' in m['name'] or 'gemma' in m['name']]
        except Exception as e:
            logger.error(f"Error fetching models: {e}")
            return ['gemini-2.0-flash', 'gemini-1.5-flash']

    async def check_availability(self, model_name: str) -> bool:
        return model_name in await self.get_available_models()

    def hard_reset(self, history_override: Optional[List[dict]] = None):
        self.history = history_override if history_override is not None else []

    def pop_last_message(self):
        if self.history:
            self.history.pop()

    def save_snapshot(self) -> bool:
        last_msg = str(self.history[-1]) if self.history else ""
        return self.snapshot_manager.save(self.system_instruction, self.history, last_msg)

    def get_history(self) -> List[dict]:
        return self.history

    def prune_history(self, max_tokens: int):
        """Prunes the history to stay within the token limit, preserving the most recent context."""
        from src.infrastructure.gemini.utils import estimate_tokens
        if len(self.history) <= 2:
            return

        while len(self.history) > 2 and estimate_tokens(self.history) > max_tokens:
            self.history.pop(0)

    def count_tokens(self, history: List[dict]) -> int:
        return estimate_tokens(history)
