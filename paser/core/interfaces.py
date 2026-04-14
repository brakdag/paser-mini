from abc import ABC, abstractmethod
from typing import Generator, Any, Optional, Union

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
    def send_message(self, message: Union[str, bytes]) -> Any:
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

class UserInterface(ABC):
    @abstractmethod
    async def request_input(self, prompt: str, history: Optional[Any] = None) -> str:
        pass

    @abstractmethod
    def display_message(self, text: str):
        pass

    @abstractmethod
    def display_thought(self, text: str):
        pass

    @abstractmethod
    def display_tool_start(self, tool_name: str, args: dict):
        pass

    @abstractmethod
    def display_tool_result(self, tool_name: str, success: bool, result: Any, detail: str = ""):
        pass

    @abstractmethod
    def display_tool_status(self, tool_name: str, success: bool, detail: str = ""):
        pass

    @abstractmethod
    def display_panel(self, title: str, message: str, style: str = "none"):
        pass

    @abstractmethod
    def display_error(self, message: str):
        pass

    @abstractmethod
    def display_info(self, message: str):
        pass

    @abstractmethod
    def get_spinner(self, message: str, color: str = "cyan", newline: bool = False):
        pass

    @abstractmethod
    def set_ui_mode(self, mode: str):
        pass

    @abstractmethod
    def get_ui_mode(self) -> str:
        pass

    @abstractmethod
    async def get_confirmation(self, message: str) -> bool:
        pass
