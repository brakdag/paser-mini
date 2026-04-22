import os
import requests
import logging
from typing import Generator, Any, Union

logger = logging.getLogger(__name__)

import sys
logger.info("NvidiaAdapter cargando...")

class NvidiaAdapter:
    def __init__(self):
        self.api_key = os.getenv("NVIDIA_API_KEY")
        self.invoke_url = "https://integrate.api.nvidia.com/v1/chat/completions"
        self.model = "meta/llama-3.1-405b-instruct"
        self.history = []
        self.system_instruction = ""
        self.temperature = 0.7
        self.chat = None

    def start_chat(self, model_name: str, system_instruction: str, temperature: float):
        self.system_instruction = system_instruction
        self.temperature = temperature
        if "/" not in model_name or ("nvidia" not in model_name and "meta" not in model_name and "google" not in model_name):
            self.model = "meta/llama-3.1-405b-instruct"
        else:
            self.model = model_name
        self.history = [{"role": "system", "content": system_instruction}]
        self.chat = True

    def send_message(self, message: str) -> str:
        self.history.append({"role": "user", "content": message})
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        payload = {
            "model": self.model,
            "messages": self.history,
            "max_tokens": 1024,
            "temperature": 0.7
        }
        try:
            response = requests.post(self.invoke_url, headers=headers, json=payload)
            response.raise_for_status()
            data = response.json()
            content = data['choices'][0]['message']['content']
            self.history.append({"role": "assistant", "content": content})
            return content
        except Exception as e:
            logger.error(f"Nvidia API error: {e}")
            return f"Error: {str(e)}"

    def send_message_stream(self, message: str) -> Generator[str, None, None]:
        yield self.send_message(message)

    def refresh_session(self):
        pass

    def count_tokens(self, contents: Any) -> int:
        # NVIDIA API doesn't have a dedicated token counter endpoint in the standard chat completions,
        # we estimate based on character count (approx 4 chars per token) as a fallback.
        text = ""
        if isinstance(contents, list):
            for item in contents:
                if hasattr(item, 'parts'):
                    for part in item.parts:
                        if hasattr(part, 'text'): text += part.text
                elif isinstance(item, dict): text += item.get('content', '')
        elif isinstance(contents, str): text = contents
        return len(text) // 4

    def get_available_models(self) -> list:
        # NVIDIA NIMs usually return models via /models endpoint
        try:
            headers = {"Authorization": f"Bearer {self.api_key}"}
            response = requests.get("https://integrate.api.nvidia.com/v1/models", headers=headers)
            response.raise_for_status()
            data = response.json()
            return [m['id'] for m in data.get('data', [])]
        except Exception as e:
            logger.error(f"Error fetching NVIDIA models: {e}")
            return ["meta/llama-3.1-405b-instruct"]