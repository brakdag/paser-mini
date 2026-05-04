import logging
from src.core.ui_interface import UserInterface
from typing import Any, Optional

logger = logging.getLogger("src")

class GitHubUI(UserInterface):
    """
    UI implementation for GitHub Mode.
    Redirects all output to logs/stdout and provides a way to capture 
    the final response for GitHub comments.
    """

    def __init__(self):
        self.output_buffer = []

    def _log_and_buffer(self, text: str, buffer: bool = False):
        logger.info(text)
        if buffer:
            self.output_buffer.append(text)

    async def request_input(self, prompt: str, history: Optional[Any] = None) -> str:
        # In GitHub mode, input is managed by the Orchestrator via the message queue.
        # This method should not be called in instance_mode.
        return ""

    def display_message(self, text: str):
        self._log_and_buffer(f"[MESSAGE] {text}", buffer=True)

    def display_thought(self, text: str):
        self._log_and_buffer(f"[THOUGHT] {text}")

    def display_info(self, message: str):
        self._log_and_buffer(f"[INFO] {message}")

    def display_error(self, message: str):
        self._log_and_buffer(f"[ERROR] {message}", buffer=True)

    def display_panel(self, title: str, message: str, style: str = "none"):
        self._log_and_buffer(f"[PANEL: {title}] {message}", buffer=True)

    def display_tool_status(self, tool_name: str, success: bool, detail: str = ""):
        status = "OK" if success else "FAIL"
        self._log_and_buffer(f"[TOOL] {tool_name} -> {status} {detail}")

    async def get_confirmation(self, message: str) -> bool:
        # Default to True in autonomous mode, or handle via a specific comment
        logger.info(f"[CONFIRMATION REQUEST] {message} -> Defaulting to True")
        return True

    def set_ui_mode(self, mode: str):
        pass

    def get_ui_mode(self) -> str:
        return "NORMAL"

    def start_tool_monitoring(self, tool_name: str, detail: str = ""):
        pass

    def end_tool_monitoring(self, tool_name: str, success: bool, detail: str = ""):
        pass

    def stop_all_monitoring(self):
        pass

    def get_buffered_output(self) -> str:
        """Returns all buffered messages as a single string."""
        return "\n\n".join(self.output_buffer)

    def clear_buffer(self):
        """Clears the output buffer."""
        self.output_buffer = []

    def add_spacing(self):
        pass
