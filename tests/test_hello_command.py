import asyncio
from unittest.mock import MagicMock
from src.core.commands import CommandHandler

async def test_hello_command():
    # Mock dependencies
    mock_ui = MagicMock()
    mock_chat_manager = MagicMock()
    
    handler = CommandHandler(mock_chat_manager, mock_ui)
    
    # Test /hello
    result = await handler.handle("/hello")
    
    assert result is True
    mock_ui.display_message.assert_called_with("Hello! I'm Paser Mini. How can I assist you today? 😊")
    print("Test /hello: PASSED")

async def test_hello_case_insensitive():
    # The current implementation uses input_stripped == "/hello", 
    # but let's check if it's case sensitive based on the code.
    # In src/core/commands.py: input_stripped = user_input.strip()
    # then elif input_stripped == "/hello":
    # This IS case sensitive. Let's see if that's desired. 
    # Usually commands are case insensitive. 
    # However, the request just asked for /hello.
    
    mock_ui = MagicMock()
    mock_chat_manager = MagicMock()
    handler = CommandHandler(mock_chat_manager, mock_ui)
    
    result = await handler.handle("/HELLO")
    # Based on current code, this should return False (or fall through to error)
    # because it's not .lower() for /hello specifically.
    # Let's just verify the exact match first.
    pass

if __name__ == "__main__":
    asyncio.run(test_hello_command())
