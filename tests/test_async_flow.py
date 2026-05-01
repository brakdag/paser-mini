import asyncio
import logging
from unittest.mock import AsyncMock, MagicMock
from src.core.chat_manager import ChatManager
from src.core.terminal_ui import TerminalUI

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("test_async")

class MockAssistant:
    def __init__(self):
        self.send_message = AsyncMock(side_effect=self._mock_response)
        self.pop_last_message = MagicMock()
        self.start_chat = MagicMock()

    async def _mock_response(self, message, role="user"):
        await asyncio.sleep(0.1) # Simulate network latency
        return "Mocked response to: " + str(message)

    def set_retry_callback(self, cb): pass

async def test_aggregation_logic():
    logger.info("Testing Message Aggregation Logic...")
    
    # Setup
    ui = TerminalUI(no_spinner=True)
    assistant = MockAssistant()
    tools = {}
    chat_manager = ChatManager(assistant, tools, "System Instr", ui)
    
    # Start the processor in the background
    processor = asyncio.create_task(chat_manager._processor_loop())
    
    # 1. Send first message
    await chat_manager.message_queue.put("Message 1")
    
    # 2. Rapidly send more messages while AI is "thinking"
    await chat_manager.message_queue.put("Message 2")
    await chat_manager.message_queue.put("Message 3")
    
    # Wait for the processor to handle the first turn and the aggregated turn
    # We expect 2 calls to send_message: one for 'Message 1', one for 'Message 2\n\nMessage 3'
    await asyncio.sleep(0.5)
    
    calls = assistant.send_message.call_args_list
    logger.info(f"Total API calls: {len(calls)}")
    
    if len(calls) >= 2:
        first_call = calls[0][0][0]
        second_call = calls[1][0][0]
        logger.info(f"First call: {first_call}")
        logger.info(f"Second call: {second_call}")
        
        if "Message 1" in first_call and "Message 2" in second_call and "Message 3" in second_call:
            logger.info("✅ Aggregation successful!")
        else:
            logger.error("❌ Aggregation failed: messages not combined correctly.")
    else:
        logger.error(f"❌ Expected at least 2 calls, got {len(calls)}")

    processor.cancel()

if __name__ == "__main__":
    asyncio.run(test_aggregation_logic())
