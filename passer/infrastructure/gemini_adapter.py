from typing import Generator, Optional, Any
from google import genai
from google.genai import types
from passer.core.interfaces import IAIAssistant

class GeminiAdapter(IAIAssistant):
    def __init__(self):
        self.client = genai.Client()
        self.chat: Any = None
        self._current_model: Optional[str] = None

    @property
    def current_model(self) -> Optional[str]:
        return self._current_model

    def start_chat(self, model_name: str, system_instruction: str, temperature: float):
        self._current_model = model_name
        self.chat = self.client.chats.create(
            model=model_name, 
            config=types.GenerateContentConfig(
                temperature=temperature,
                system_instruction=system_instruction
            )
        )

    def send_message_stream(self, message: str) -> Generator[str, None, None]:
        if not self.chat:
            yield ""
            return
        response = self.chat.send_message_stream(message)
        for chunk in response:
            if hasattr(chunk, 'text') and chunk.text:
                yield chunk.text

    def send_message(self, message: str) -> Any:
        if not self.chat:
            return None
        return self.chat.send_message(message)

    def get_available_models(self) -> list:
        # Relaxed filtering to ensure models appear
        models = self.client.models.list()
        return [m.name for m in models if m.name and ('gemini' in m.name or 'gemma' in m.name)]
