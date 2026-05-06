from src.infrastructure.memento.manager import MementoManager
import logging
from typing import Optional

# Singleton instance of the Memento Manager
_manager = MementoManager()

# We need a way to access the current ChatManager/Assistant for token counting
_current_assistant = None
_current_chat_manager = None


def set_assistant(assistant):
    global _current_assistant
    _current_assistant = assistant


def set_chat_manager(chat_manager):
    global _current_chat_manager
    _current_chat_manager = chat_manager


async def pushMemory(
    scope: str, value: str, key: Optional[str] = None, pointers: Optional[list] = None
) -> str:
    """
    Stores a piece of information in the long-term memory graph.

    Args:
        scope (str): 'tattoo' for core truths, 'fractal' for general knowledge.
        value (str): The content to store.
        key (str, optional): A unique identifier or name for the memory.
        pointers (list, optional): A list of node IDs to link this memory to.
    """
    try:
        return await _manager.pushMemory(
            role="Agent", scope=scope, value=value, key=key, pointers=pointers
        )
    except Exception as e:
        return f"ERR: {str(e)}"


async def pullMemory(
    scope: Optional[str] = None,
    key: Optional[str] = None,
    direction: Optional[str] = None,
) -> str:
    """
    Retrieves information from the long-term memory graph.

    Args:
        scope (str, optional): 'tattoo' or 'fractal'. If None and other args are None, performs 'The Mirror' effect.
        key (str, optional): The ID of the node to retrieve or the current node for navigation.
        direction (str, optional): 'next', 'prev', 'up', 'down' for graph navigation.
    """
    try:
        # Convert empty strings to None
        s = scope if scope not in (None, "") else None
        k = key if key not in (None, "") else None
        d = direction if direction not in (None, "") else None

        # If all are None, MementoManager.pullMemory handles 'The Mirror' internally
        return await _manager.pullMemory(scope=s, key=k, direction=d)
    except Exception as e:
        # Fallback to Mirror if specific pull fails
        try:
            return await _manager.pullMemory(scope=None, key=None, direction=None)
        except Exception as e2:
            return f"ERR: {str(e2)}"


def getTokenCount() -> str:
    """
    Returns the current token count of the conversation history.
    """
    try:
        if _current_assistant is None:
            return "ERR: Assistant not initialized in memory tools."

        count = _current_assistant.count_tokens(_current_assistant.history)
        limit = 250000
        if _current_chat_manager:
            limit = _current_chat_manager.context_window_limit

        percentage = (count / limit) * 100
        return f"Current tokens: {count} / {limit} ({percentage:.2f}%)"
    except Exception as e:
        return f"ERR: {str(e)}"
