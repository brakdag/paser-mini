import asyncio
from unittest.mock import MagicMock
from src.core.commands import CommandHandler

async def test_ping_command():
    # Mock dependencies
    mock_ui = MagicMock()
    mock_chat_manager = MagicMock()
    
    handler = CommandHandler(mock_chat_manager, mock_ui)
    
    # Test /ping
    result = await handler.handle("/ping")
    
    assert result is True
    mock_ui.display_message.assert_called_with("pong")
    print("Test /ping: PASSED")

if __name__ == "__main__":
    asyncio.run(test_ping_command())
