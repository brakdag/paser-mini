from src.core.ui_interface import UserInterface
from typing import Any, Optional, List

class MockUI(UserInterface):
    """
    Mock implementation of UserInterface for testing purposes.
    Captures all output in lists for verification.
    """
    def __init__(self):
        self.messages = []
        self.thoughts = []
        self.infos = []
        self.errors = []
        self.panels = []
        self.tool_statuses = []
        self.input_responses = []
        self.mode = "INSERT"

    async def request_input(self, prompt: str, history: Optional[Any] = None) -> str:
        if self.input_responses:
            return self.input_responses.pop(0)
        return ""

    def display_message(self, text: str):
        self.messages.append(text)

    def display_thought(self, text: str):
        self.thoughts.append(text)

    def display_info(self, message: str):
        self.infos.append(message)

    def display_error(self, message: str):
        self.errors.append(message)

    def display_panel(self, title: str, message: str, style: str = "none"):
        self.panels.append((title, message, style))

    def display_tool_status(self, tool_name: str, success: bool, detail: str = ""):
        self.tool_statuses.append((tool_name, success, detail))

    async def get_confirmation(self, message: str) -> bool:
        if self.input_responses:
            res = self.input_responses.pop(0)
            return res.lower().strip() == 'y'
        return False

    def set_ui_mode(self, mode: str):
        self.mode = mode

    def get_ui_mode(self) -> str:
        return self.mode

    def add_spacing(self):
        pass
