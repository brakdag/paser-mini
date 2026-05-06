from abc import ABC, abstractmethod
from typing import Any, Optional

class UserInterface(ABC):
    """
    Abstract Base Class defining the contract for the User Interface.
    Ensures that the core logic remains agnostic of the presentation layer.
    """

    @abstractmethod
    async def request_input(self, prompt: str, history: Optional[Any] = None) -> str:
        """Request text input from the user."""
        pass

    @abstractmethod
    def display_message(self, text: str):
        """Display a general message to the user (usually formatted as Markdown)."""
        pass

    @abstractmethod
    def display_thought(self, text: str):
        """Display the agent's internal reasoning/thoughts."""
        pass

    @abstractmethod
    def display_info(self, message: str):
        """Display an informational message."""
        pass

    @abstractmethod
    def display_error(self, message: str):
        """Display an error message."""
        pass

    @abstractmethod
    def display_panel(self, title: str, message: str, style: str = "none"):
        """Display a message inside a titled panel."""
        pass

    @abstractmethod
    def display_tool_status(self, tool_name: str, success: bool, detail: str = ""):
        """Display the status of a tool execution."""
        pass

    @abstractmethod
    async def get_confirmation(self, message: str) -> bool:
        """Request a yes/no confirmation from the user."""
        pass

    @abstractmethod
    def start_tool_monitoring(self, tool_name: str, detail: str = ""):
        """Signals the start of a tool execution and activates the spinner."""
        pass

    @abstractmethod
    def end_tool_monitoring(self, tool_name: str, success: bool, detail: str = ""):
        """Updates the current line with the result ([OK/FAIL]) and keeps the spinner active."""
        pass

    @abstractmethod
    def stop_all_monitoring(self):
        """Stops any active monitoring and commits the final status to the terminal."""
        pass
