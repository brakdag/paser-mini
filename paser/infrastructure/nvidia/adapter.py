import os
import logging
from typing import Generator, Any, List
from openai import OpenAI

logger = logging.getLogger(__name__)

class NvidiaAdapter:
    """
    Elite Adapter for NVIDIA NIM APIs using the OpenAI-compatible SDK.
    Optimized for low latency and native streaming support.
    """
    def __init__(self):
        self.api_key = os.getenv("NVIDIA_API_KEY")
        self.base_url = "https://integrate.api.nvidia.com/v1"
        
        # Initialize the OpenAI client for NVIDIA's compatible endpoint
        self.client = OpenAI(api_key=self.api_key, base_url=self.base_url)
        
        self._current_model = "meta/llama-3.1-405b-instruct"
        from openai.types.chat import ChatCompletionMessageParam
        self.history: Any = []
        self.system_instruction = ""
        self.temperature = 0.7
        self._availability_cache = {}

    def start_chat(self, model_name: str, system_instruction: str, temperature: float):
        """
        Configures the chat session with a specific model and system prompt.
        """
        self.system_instruction = system_instruction
        self.temperature = temperature
        
        # Flexible model selection: allow any model that looks like a path or contains known brands
        if model_name and ("/" in model_name or any(brand in model_name.lower() for brand in ["nvidia", "meta", "google", "qwen", "mistral"])):
            self._current_model = model_name
        else:
            # Default fallback
            self._current_model = "meta/llama-3.1-405b-instruct"
            
        self.history = [{"role": "system", "content": system_instruction}]
        logger.info(f"NvidiaAdapter session started with model: {self._current_model}")

    def send_message(self, message: str, max_tokens: int = 512) -> str:
        self.history.append({"role": "user", "content": message})
        self._truncate_history()
        try:
            response = self.client.chat.completions.create(
                model=self._current_model,
                messages=self.history,
                temperature=self.temperature,
                max_tokens=max_tokens
            )
            content = response.choices[0].message.content or ""
            self.history.append({"role": "assistant", "content": content})
            return content
        except Exception as e:
            logger.error(f"Nvidia API error: {e}")
            return f"Error: {str(e)}"

    def send_message_stream(self, message: str, max_tokens: int = 512) -> Generator[str, None, None]:
        """
        True streaming implementation using OpenAI SDK's stream=True.
        Yields chunks as they arrive from the NVIDIA API.
        """
        self.history.append({"role": "user", "content": message})
        self._truncate_history()
        try:
            response = self.client.chat.completions.create(
                model=self._current_model,
                messages=self.history, # type: ignore
                temperature=self.temperature,
                max_tokens=max_tokens,
                stream=True
            )
            
            full_content = ""
            for chunk in response:
                content = chunk.choices[0].delta.content
                if content:
                    full_content += content
                    yield content
            
            # Update history with the full aggregated response
            self.history.append({"role": "assistant", "content": full_content})
            
        except Exception as e:
            logger.error(f"Nvidia API streaming error: {e}")
            yield f"Error: {str(e)}"

    def inject_message(self, role: str, content: str):
        """
        Injects a message directly into the history without sending it to the API.
        """
        self.history.append({"role": role, "content": content})

    def _truncate_history(self):
        if len(self.history) > 11:
            self.history = [self.history[0]] + self.history[-10:]

    def refresh_session(self):
        """Resets the chat history."""
        self.history = [{"role": "system", "content": self.system_instruction}]

    def get_chat_history(self):
        """Returns the current chat history."""
        return self.history

    def count_tokens(self, contents: Any) -> int:
        """
        Heuristic token estimation (approx 4 chars per token).
        """
        text = ""
        if isinstance(contents, list):
            for item in contents:
                if isinstance(item, dict):
                    text += item.get('content', '')
                elif hasattr(item, 'parts'):
                    for part in item.parts:
                        if hasattr(part, 'text'): text += part.text
                elif isinstance(item, str):
                    text += item
        elif isinstance(contents, str):
            text = contents
        return len(text) // 4

    def check_availability(self, model_name: str) -> bool:
        import time
        now = time.time()
        if model_name in self._availability_cache:
            available, timestamp = self._availability_cache[model_name]
            if now - timestamp < 300: return available
        
        try:
            self.client.chat.completions.create(
                model=model_name,
                messages=[{"role": "user", "content": "hi"}],
                max_tokens=1
            )
            self._availability_cache[model_name] = (True, now)
            return True
        except Exception as e:
            self._availability_cache[model_name] = (False, now)
            return False

    def get_available_models(self) -> list:
        """
        Fetches the list of available models from the NVIDIA API.
        """
        try:
            models = self.client.models.list()
            return [m.id for m in models.data]
        except Exception as e:
            logger.error(f"Error fetching NVIDIA models: {e}")
            return ["meta/llama-3.1-405b-instruct"]