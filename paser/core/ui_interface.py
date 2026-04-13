from abc import ABC, abstractmethod
from typing import Any, Optional

class UserInterface(ABC):
    """
    Abstract Base Class that defines the contract for the User Interface.
    The core logic depends on this interface, not on a concrete implementation.
    """

    @abstractmethod
    async def request_input(self, prompt: str, history: Optional[Any] = None) -> str:
        """Request text input from the user."""
        pass

    @abstractmethod
    async def get_confirmation(self, message: str) -> bool:
        """Asynchronous confirmation prompt for security-sensitive tools."""
        pass

    @abstractmethod
    def display_message(self, text: str):
        """Display a general message to the user."""
        pass

    @abstractmethod
    def display_thought(self, text: str):
        """Display the AI's internal reasoning/thoughts."""
        pass

    @abstractmethod
    def display_tool_start(self, tool_name: str, args: dict):
        """Notify the user that a tool is starting to execute."""
        pass

    @abstractmethod
    def display_tool_result(self, tool_name: str, success: bool, result: Any, detail: str = ""):
        """Notify the user about the result of a tool execution."""
        pass

    @abstractmethod
    def display_tool_status(self, tool_name: str, success: bool, detail: str = ""):
        """Display a brief status line for a tool execution."""
        pass

    @abstractmethod
    def display_panel(self, title: str, message: str, style: str = "none"):
        """Display a formatted panel with a title and message."""
        pass

    @abstractmethod
    def display_error(self, message: str):
        """Display an error message in a prominent way."""
        pass

    @abstractmethod
    def display_info(self, message: str):
        """Display an informational message."""
        pass

    @abstractmethod
    def get_spinner(self, message: str, color: str = "cyan", newline: bool = False):
        """
        Returns a context manager for displaying a loading spinner.
        Usage: with ui.get_spinner("Loading..."):
            # do work
        """
        pass

    @abstractmethod
    def set_ui_mode(self, mode: str):
        """Change the current UI mode (e.g., NORMAL, INSERT, AUDIO)."""
        pass

    @abstractmethod
    def get_ui_mode(self) -> str:
        """Get the current UI mode."""
        pass
