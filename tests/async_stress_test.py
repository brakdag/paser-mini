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
        self.call_count = 0

    async def send_message(self, message, role="user"):
        self.call_count += 1
        # Simulate variable API latency to trigger race conditions
        await asyncio.sleep(0.5)
        return f"Mock Response {self.call_count}"

async def test_high_pressure_queue():
    logger.info("\n--- Testing High Pressure Message Queue ---")
    ui = TerminalUI(no_spinner=True)
    assistant = MockAssistant()
    cm = ChatManager(assistant, {}, "System Instr", ui)
    
    # Start the processor loop
    processor = asyncio.create_task(cm._processor_loop())
    
    # 1. Trigger initial processing
    await cm.message_queue.put("Initial Request")
    
    # 2. The Flood: Inject 20 messages while the AI is "thinking"
    logger.info("Flooding queue with 20 messages...")
    for i in range(20):
        await cm.message_queue.put(f"Burst Message {i}")
    
    # 3. Wait for the state machine to flush everything
    # We expect: 1st call (Initial) + subsequent calls (Aggregated bursts)
    # Depending on timing, it might be 2 or 3 calls total.
    await asyncio.sleep(5)
    
    # Verification
    calls = assistant.send_message.call_args_list
    total_api_calls = len(calls)
    
    # Combine all sent text to ensure no message was lost
    all_sent_text = " ".join([call[0][0] for call in calls])
    
    logger.info(f"Total API calls: {total_api_calls}")
    
    missing_messages = 0
    for i in range(20):
        if f"Burst Message {i}" not in all_sent_text:
            missing_messages += 1

    if missing_messages == 0:
        logger.info("✅ High pressure test passed: No messages lost!")
    else:
        logger.error(f"❌ High pressure test failed: {missing_messages} messages lost!")
        raise RuntimeError(f"Message loss detected in ChatManager queue.")
    
    processor.cancel()

async def test_emergency_stop_resilience():
    logger.info("\n--- Testing Emergency Stop Resilience ---")
    ui = TerminalUI(no_spinner=True)
    assistant = MockAssistant()
    # Simulate a hanging API call
    assistant.send_message = AsyncMock(side_effect=lambda m, r="user": asyncio.sleep(100))
    
    cm = ChatManager(assistant, {}, "System Instr", ui)
    processor = asyncio.create_task(cm._processor_loop())
    
    await cm.message_queue.put("Hanging request")
    await asyncio.sleep(0.2)
    
    start = time.perf_counter()
    cm.stop_execution()
    
    # The stop should be near-instant
    await asyncio.sleep(0.1)
    end = time.perf_counter()
    
    if end-start < 1.0:
        logger.info(f"✅ Emergency Stop is instant ({end-start:.2f}s)!")
    else:
        logger.error(f"❌ Emergency Stop is too slow ({end-start:.2f}s).")
        raise RuntimeError("Emergency stop failed to interrupt execution promptly.")
    
    processor.cancel()

async def main():
    try:
        await test_high_pressure_queue()
        await test_emergency_stop_resilience()
    except Exception as e:
        logger.error(f"Stress test suite failed: {e}")
        exit(1)

if __name__ == "__main__":
    asyncio.run(main())
