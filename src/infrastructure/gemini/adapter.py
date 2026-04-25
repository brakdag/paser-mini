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
        for chunk in self.client.generate_content(self._current_model or "", payload, stream=True):
            full_text += chunk
            yield chunk
        
        self.history.append({"role": "model", "parts": [{"text": full_text}]})

    def send_message(self, message: Union[str, bytes]) -> Any:
        parts = [{"text": message}] if isinstance(message, str) else [{"inline_data": {"mime_type": "audio/wav", "data": base64.b64encode(message).decode()}}]
        self.history.append({"role": "user", "parts": parts})
        
        payload = {"contents": self.history, "generationConfig": {"temperature": self.temperature}}
        response = self.client.generate_content(self._current_model or "gemini-2.0-flash", payload)
        
        text = response.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "")
        self.history.append({"role": "model", "parts": [{"text": text}]})
        return text

    def inject_message(self, role: str, content: str):
        self.history.append({"role": role, "parts": [{"text": content}]})

    def load_history(self, history_data: List[dict], model_name: str, temperature: float):
        self._current_model = model_name
        self.temperature = temperature
        self.history = history_data

    def get_available_models(self) -> List[str]:
        # Placeholder: Implement logic to fetch models via REST if needed
        return ["gemini-2.0-flash", "gemini-1.5-flash"]

    def hard_reset(self):
        self.history = []

    def get_history(self) -> List[dict]:
        return self.history
