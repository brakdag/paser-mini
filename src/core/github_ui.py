import logging
from src.core.ui_interface import UserInterface
from src.tools import github_tools
from typing import Any, Optional

logger = logging.getLogger("src")

class GitHubUI(UserInterface):
    """
    UI implementation for GitHub Mode.
    Posts AI responses directly to GitHub issues in real-time.
    """

    def __init__(self, issue_number: int, repo: Optional[str] = None):
        self.issue_number = issue_number
        self.repo = repo or github_tools.get_current_repo()

    async def request_input(self, prompt: str, history: Optional[Any] = None) -> str:
        # Input is managed by the Orchestrator via the message queue.
        return ""

    def display_message(self, text: str):
        """
        Posts the AI's final response for the current turn directly to GitHub.
        """
        logger.info(f"[POSTING TO GITHUB] {text}")
        try:
            github_tools.post_comment(self.issue_number, text, self.repo)
        except Exception as e:
            logger.error(f"Failed to post comment to GitHub: {e}")

    def display_thought(self, text: str):
        logger.info(f"[THOUGHT] {text}")

    def display_info(self, message: str):
        logger.info(f"[INFO] {message}")

    def display_error(self, message: str):
        logger.error(f"[ERROR] {message}")

    def display_panel(self, title: str, message: str, style: str = "none"):
        logger.info(f"[PANEL: {title}] {message}")

    def display_tool_status(self, tool_name: str, success: bool, detail: str = ""):
        status = "OK" if success else "FAIL"
        logger.info(f"[TOOL] {tool_name} -> {status} {detail}")

    async def get_confirmation(self, message: str) -> bool:
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

    def add_spacing(self):
        pass

    def update_queue_count(self, count: int):
        """Does nothing in GitHub mode as there is no visual queue."""
        pass
