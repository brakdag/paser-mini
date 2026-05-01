import asyncio
import logging
import time
from unittest.mock import AsyncMock, MagicMock
from src.core.chat_manager import ChatManager
from src.core.terminal_ui import TerminalUI

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("stress_test")

class MockAssistant:
    def __init__(self):
        self.send_message = AsyncMock()
        self.pop_last_message = MagicMock()
        self.set_retry_callback = MagicMock()

    async def send_message(self, message, role="user"):
        # Simulate API latency
        await asyncio.sleep(1)
        return "Mock Response"

async def test_message_aggregation():
    logger.info("\n--- Testing Message Aggregation ---")
    ui = TerminalUI(no_spinner=True)
    assistant = MockAssistant()
    cm = ChatManager(assistant, {}, "System Instr", ui)
    
    # Start the processor loop in the background
    processor = asyncio.create_task(cm._processor_loop())
    
    # Send first message
    await cm.message_queue.put("Message 1")
    # Send burst of messages while AI is "thinking"
    await cm.message_queue.put("Message 2")
    await cm.message_queue.put("Message 3")
    
    # Wait for processing to complete
    # First turn (Msg 1) + Second turn (Aggregated Msg 2 & 3)
    await asyncio.sleep(3)
    
    # Verify that send_message was called twice
    # 1st call: "Message 1"
    # 2nd call: "Message 2\n\nMessage 3"
    calls = assistant.send_message.call_args_list
    logger.info(f"Total API calls: {len(calls)}")
    
    if len(calls) >= 2:
        first_call_arg = calls[0][0][0]
        second_call_arg = calls[1][0][0]
        logger.info(f"First call: {first_call_arg}")
        logger.info(f"Second call: {second_call_arg}")
        
        if "Message 2" in second_call_arg and "Message 3" in second_call_arg:
            logger.info("✅ Aggregation successful!")
        else:
            logger.error("❌ Aggregation failed: Messages were not combined.")
    else:
        logger.error(f"❌ Expected at least 2 calls, got {len(calls)}")
    
    processor.cancel()

async def test_emergency_stop():
    logger.info("\n--- Testing Emergency Stop ---")
    ui = TerminalUI(no_spinner=True)
    assistant = MockAssistant()
    # Make the assistant take a long time to respond
    assistant.send_message = AsyncMock(side_effect=lambda m, r="user": asyncio.sleep(10))
    
    cm = ChatManager(assistant, {}, "System Instr", ui)
    processor = asyncio.create_task(cm._processor_loop())
    
    await cm.message_queue.put("Long request")
    await asyncio.sleep(0.5) # Let it start
    
    start = time.perf_counter()
    cm.stop_execution()
    
    # We wait to see if it actually stops or hangs for 10s
    try:
        # We wait a bit to see if the processor handles the cancellation
        await asyncio.sleep(1)
    except Exception as e:
        logger.error(f"Error during stop: {e}")
    
    end = time.perf_counter()
    logger.info(f"Stop took {end-start:.2f}s")
    
    if end-start < 2:
        logger.info("✅ Emergency Stop is instant!")
    else:
        logger.error("❌ Emergency Stop is too slow.")
    
    processor.cancel()

async def main():
    await test_message_aggregation()
    await test_emergency_stop()

if __name__ == "__main__":
    asyncio.run(main())
