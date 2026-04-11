import logging
from typing import Any

logger = logging.getLogger(__name__)

class ContextManager:
    def __init__(self, max_tokens: int = 30000):
        self.max_tokens = max_tokens

    def optimize_history(self, history: list, assistant: Any) -> list:
        """
        Recorta el historial manteniendo el SYSTEM_PROMPT (índice 0).
        """
        if not history:
            return history

        current_tokens = assistant.count_tokens(history)
        if current_tokens <= self.max_tokens:
            return history

        logger.info(f"Context limit exceeded ({current_tokens}/{self.max_tokens}). Optimizing...")
        
        # Mantener el primer elemento (System Prompt)
        system_prompt = history[0]
        remaining_history = history[1:]

        # Estrategia simple: descartar mensajes antiguos hasta que quepa
        while len(remaining_history) > 1 and assistant.count_tokens([system_prompt] + remaining_history) > self.max_tokens:
            remaining_history.pop(0)

        return [system_prompt] + remaining_history
