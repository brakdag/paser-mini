import asyncio
import logging
import time
from src.core.chat_manager import ChatManager
from src.core.terminal_ui import TerminalUI

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("stress_test")

class MockAssistant:
    def __init__(self):
        self.call_count = 0
        self.history = [] # Added to fix 'no attribute history' error

    async def send_message(self, message, role="user"):
        self.call_count += 1
        # Simulate variable API latency
        await asyncio.sleep(0.5)
        response = f"Mock Response {self.call_count}"
        self.history.append({"role": role, "content": message})
        self.history.append({"role": "assistant", "content": response})
        return response

    def count_tokens(self, text: str) -> int:
        return len(text) // 4

    def pop_last_message(self):
        return self.history.pop() if self.history else None

    def set_retry_callback(self, callback):
        pass

async def test_high_pressure_queue():
    logger.info("\n--- Testing High Pressure Message Queue ---")
    ui = TerminalUI(no_spinner=True)
    assistant = MockAssistant()
    cm = ChatManager(assistant, {}, "System Instr", ui)
    
    processor = asyncio.create_task(cm._processor_loop())
    
    await cm.message_queue.put("Initial Request")
    
    logger.info("Flooding queue with 20 messages...")
    for i in range(20):
        await cm.message_queue.put(f"Burst Message {i}")
    
    await asyncio.sleep(5)
    
    # Verification
    # We check the assistant's history instead of call_args_list
    all_sent_text = " ".join([m['content'] for m in assistant.history if m['role'] == 'user'])
    
    logger.info(f"Total API calls: {assistant.call_count}")
    
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
    
    # Override send_message to hang
    async def hanging_send(m, r="user"):
        await asyncio.sleep(100)
        return "Never"
    assistant.send_message = hanging_send
    
    cm = ChatManager(assistant, {}, "System Instr", ui)
    processor = asyncio.create_task(cm._processor_loop())
    
    await cm.message_queue.put("Hanging request")
    await asyncio.sleep(0.2)
    
    start = time.perf_counter()
    cm.stop_execution()
    
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