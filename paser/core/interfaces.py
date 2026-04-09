from abc import ABC, abstractmethod
from typing import Generator, Any, Optional

class IAIAssistant(ABC):
    @property
    @abstractmethod
    def current_model(self) -> Optional[str]:
        pass

    @abstractmethod
    def start_chat(self, model_name: str, system_instruction: str, temperature: float):
        pass
    
    @abstractmethod
    def send_message_stream(self, message: str) -> Generator[str, None, None]:
        pass
    
    @abstractmethod
    def send_message(self, message: str) -> Any:
        pass
        
    @abstractmethod
    def get_available_models(self) -> list:
        pass

    @abstractmethod
    def get_chat_history(self) -> Any:
        pass

    @abstractmethod
    def get_history(self) -> list:
        pass

    @abstractmethod
    def load_history(self, history_data: list, model_name: str, temperature: float):
        pass

    @abstractmethod
    def count_tokens(self, contents: Any) -> int:
        pass
