import os
import logging
from typing import AsyncGenerator, Any, List, Optional, Union, Callable
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
        self.retry_callback: Optional[Callable[[str], None]] = None

    def set_retry_callback(self, callback: Callable[[str], None]):
        """Permite que el ChatManager asigne una función para mostrar reintentos en la UI."""
        self.retry_callback = callback
        self.retry_handler.set_callback(callback)

    def start_chat(self, model_name: str, system_instruction: str, temperature: float):
        self.system_instruction = system_instruction
        self.temperature = temperature
        self._current_model = model_name if model_name else "meta/llama-3.1-405b-instruct"
        self.history = [{"role": "system", "content": system_instruction}]

    async def send_message(self, message: str, role: str = "user", max_tokens: int = 512) -> str:
        api_role = "assistant" if role == "model" else role
        self.history.append({"role": api_role, "content": message})
        try:
            payload = {"model": self._current_model, "messages": self.history, "temperature": self.temperature, "max_tokens": max_tokens}
            # El retry_handler ahora es el único responsable de los reintentos
            response = await self.retry_handler.execute(self.client.chat_completions, payload)
            content = response.get("choices", [{}])[0].get("message", {}).get("content", "")
            self.history.append({"role": "assistant", "content": content})
            return content
        except Exception as e:
            return f"Error: {str(e)}"

    async def send_message_stream(self, message: str, role: str = "user", max_tokens: int = 512) -> AsyncGenerator[str, None]:
        api_role = "assistant" if role == "model" else role
        self.history.append({"role": api_role, "content": message})
        try:
            payload = {"model": self._current_model, "messages": self.history, "temperature": self.temperature, "max_tokens": max_tokens}
            full_content = ""
            # El streaming no suele reintentarse automáticamente para no romper el flujo de tokens
            async for chunk in await self.client.chat_completions(payload, stream=True):
                full_content += chunk
                yield chunk
            self.history.append({"role": "assistant", "content": full_content})
        except Exception as e:
            yield f"Error: {str(e)}"

    async def get_available_models(self) -> List[str]:
        try:
            data = await self.client.get("models")
            return [m['id'] for m in data.get('data', [])]
        except:
            return ["meta/llama-3.1-405b-instruct"]

    async def check_availability(self, model_name: str) -> bool:
        payload = {"model": model_name, "messages": [{"role": "user", "content": "hi"}], "max_tokens": 1}
        result = await self.client.chat_completions(payload)
        return result is not None

    def hard_reset(self, history_override: Optional[List] = None):
        self.history = history_override or [{"role": "system", "content": self.system_instruction}]

    def get_history(self) -> List: return self.history
    def inject_message(self, role: str, content: str): self.history.append({"role": role, "content": content})
    def count_tokens(self, contents: Any) -> int:
        total_chars = sum(len(str(msg.get("content", ""))) for msg in contents)
        return total_chars // 4

    def save_snapshot(self) -> bool:
        last_msg = str(self.history[-1]) if self.history else ""
        return self.snapshot_manager.save(self.system_instruction, self.history, last_msg)

    async def close(self):
        await self.client.close()
