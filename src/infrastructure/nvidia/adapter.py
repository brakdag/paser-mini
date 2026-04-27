import os
import logging
from typing import Generator, Any, List, Optional, Union
from .rest_client import NvidiaRestClient
from .snapshot_manager import SnapshotManager

logger = logging.getLogger(__name__)

class NvidiaAdapter:
    def __init__(self):
        self.api_key = os.getenv("NVIDIA_API_KEY")
        self.client = NvidiaRestClient()
        from .retry_handler import NvidiaRetryHandler
        self.retry_handler = NvidiaRetryHandler()
        self._current_model = "meta/llama-3.1-405b-instruct"
        self.history: Any = []
        self.system_instruction = ""
        self.temperature = 0.7
        self._availability_cache = {}
        self.snapshot_manager = SnapshotManager()

    def start_chat(self, model_name: str, system_instruction: str, temperature: float):
        self.system_instruction = system_instruction
        self.temperature = temperature
        self._current_model = model_name if model_name else "meta/llama-3.1-405b-instruct"
        self.history = [{"role": "system", "content": system_instruction}]

    def send_message(self, message: str, role: str = "user", max_tokens: int = 512) -> str:
        api_role = "assistant" if role == "model" else role
        self.history.append({"role": api_role, "content": message})
        try:
            payload = {"model": self._current_model, "messages": self.history, "temperature": self.temperature, "max_tokens": max_tokens}
            response = self.retry_handler.execute(self.client.chat_completions, payload)
            content = response.get("choices", [{}])[0].get("message", {}).get("content", "")
            self.history.append({"role": "assistant", "content": content})
            return content
        except Exception as e:
            return f"Error: {str(e)}"

    def send_message_stream(self, message: str, role: str = "user", max_tokens: int = 512) -> Generator[str, None, None]:
        api_role = "assistant" if role == "model" else role
        self.history.append({"role": api_role, "content": message})
        try:
            payload = {"model": self._current_model, "messages": self.history, "temperature": self.temperature, "max_tokens": max_tokens}
            full_content = ""
            for chunk in self.client.chat_completions(payload, stream=True):
                full_content += chunk
                yield chunk
            self.history.append({"role": "assistant", "content": full_content})
        except Exception as e:
            yield f"Error: {str(e)}"

    def get_available_models(self) -> List[str]:
        try:
            data = self.client.get("models")
            return [m['id'] for m in data.get('data', [])]
        except:
            return ["meta/llama-3.1-405b-instruct"]

    def check_availability(self, model_name: str) -> bool:
        try:
            payload = {"model": model_name, "messages": [{"role": "user", "content": "hi"}], "max_tokens": 1}
            self.client.chat_completions(payload)
            return True
        except Exception:
            return False

    def hard_reset(self, history_override: Optional[List] = None):
        self.history = history_override or [{"role": "system", "content": self.system_instruction}]

    def get_history(self) -> List: return self.history
    def inject_message(self, role: str, content: str): self.history.append({"role": role, "content": content})
    def count_tokens(self, contents: Any) -> int:
        # Simple estimation: 1 token ~= 4 characters
        total_chars = sum(len(str(msg.get("content", ""))) for msg in contents)
        return total_chars // 4

    def save_snapshot(self) -> bool:
        last_msg = str(self.history[-1]) if self.history else ""
        return self.snapshot_manager.save(self.system_instruction, self.history, last_msg)
