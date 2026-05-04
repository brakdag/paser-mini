import json
import re
import os
import asyncio
import threading
import logging
import time
from typing import Any, Optional, Union, Callable, List
from collections import deque
from prompt_toolkit.patch_stdout import patch_stdout

from src.core.commands import CommandHandler
from src.core.repetition_detector import RepetitionDetector
from src.core.config_manager import ConfigManager
from src.core.smart_parser import SmartToolParser
from src.tools import ToolError

from src.core.tool_tracker import ToolAttemptTracker
from src.core.execution_engine import ExecutionEngine

logger = logging.getLogger("src")


class EmergencyStopException(Exception):
    """Exception raised when the user triggers the emergency stop (Esc key)."""
    pass


class ChatManager:
    def __init__(self, assistant, tools, system_instruction, ui, instance_mode=False):
        self.assistant = assistant
        self.tools = tools.copy() if isinstance(tools, dict) else tools
        self.system_instruction = system_instruction
        self.ui = ui
        self.instance_mode = instance_mode

        # Modularized Components
        self.config_manager = ConfigManager()
        self.tool_parser = SmartToolParser()

        self.thinking_enabled = self.config_manager.get("thinking_enabled", False)
        self.temperature = float(self.config_manager.get("default_temperature", 0.7))
        self.context_window_limit = int(
            self.config_manager.get("context_window_limit", 250000)
        )
        self.rpm_limit = 15  # Límite estricto para evitar errores 429
        self.tpm_limit = int(self.config_manager.get("tpm_limit", 15000))
        self.auto_rpm_enabled = False # Desactivado para usar RPM fijo
        self.timestamps_enabled = self.config_manager.get("timestamps_enabled", False)
        self.safemode = self.config_manager.get("safemode", False)
        self.last_response_time = 0
        self.request_timestamps = deque()

        self.command_handler = CommandHandler(self, ui)
        self.assistant.set_retry_callback(ui.display_info)

        self.repetition_detector = RepetitionDetector(n=5, max_repeats=5)
        self.engine = ExecutionEngine(
            self.assistant, self.tools, self.tool_parser, self.ui, self.instance_mode
        )
        self.session_accessed_nodes = set()
        self.max_turns = 10000
        self.turn_count = 0
        
        # Async State Management
        self.message_queue = asyncio.Queue()
        self.current_task: Optional[asyncio.Task] = None
        self.stop_requested = False
        self.should_exit = False
        
        self._initialized_event = threading.Event()
        self._init_error = None

    def save_config(self, key, value):
        if self.instance_mode:
            self.config_manager.config[key] = value
            return
        self.config_manager.save(key, value)

    async def _wait_for_rate_limit(self):
        if self.auto_rpm_enabled:
            current_tokens = getattr(self.assistant, "_cached_tokens", 1000)
            self.rpm_limit = max(1, int(self.tpm_limit / max(current_tokens, 1000)))
            logger.debug(f"Auto-RPM: Adjusted limit to {self.rpm_limit}")

        now = asyncio.get_event_loop().time()
        min_interval = 60.0 / self.rpm_limit

        if self.request_timestamps:
            last_request_time = self.request_timestamps[-1]
            elapsed = now - last_request_time
            if elapsed < min_interval:
                wait_time = min_interval - elapsed
                await asyncio.sleep(wait_time)
                now = asyncio.get_event_loop().time()

        self.request_timestamps.append(now)
        if len(self.request_timestamps) > 1:
            self.request_timestamps.popleft()

    def _extract_text(self, response) -> str:
        return response.text if hasattr(response, "text") and response.text else str(response)

    def _sanitize_text(self, text: str) -> str:
        if not text:
            return ""
        # Elimina surrogates no permitidos que causan crashes en UTF-8
        return text.encode("utf-8", "surrogatepass").decode("utf-8", "replace")

    def _process_and_display_result(self, result: str) -> None:
        if not result:
            return
        sanitized_result = self._sanitize_text(result)
        cleaned_result = self.tool_parser.clean_response(sanitized_result)
        self.ui.add_spacing()
        if self.timestamps_enabled:
            cleaned_result += f"\n\n*Response time: {self.last_response_time:.2f}s*"
        self.ui.display_message(cleaned_result)
        self.ui.add_spacing()

    async def execute(
        self,
        user_input: Union[str, bytes],
        thinking_enabled: bool = True,
        get_confirmation_callback: Optional[Callable[[str], Any]] = None,
    ) -> str:
        self.turn_count = 1
        self.engine.tool_tracker.reset()
        self.last_response_time = 0.0

        if isinstance(user_input, str):
            rep_res = self.repetition_detector.add_text(user_input)
            if rep_res is not True:
                return f"Repetitive text detected: possible infinite loop. Sequence: '{rep_res}'"

        try:
            await self._wait_for_rate_limit()
            start_time = time.perf_counter()
            response = await self.assistant.send_message(user_input)
            self.last_response_time += time.perf_counter() - start_time
            response_text = self._extract_text(response)

            while True:
                rep_res = self.repetition_detector.add_text(response_text)
                if rep_res is not True:
                    return f"Repetitive text detected: possible infinite loop. Sequence: '{rep_res}'"

                calls = self.tool_parser.extract_tool_calls(response_text)
                if not calls:
                    break

                self.turn_count += 1
                if self.turn_count > self.max_turns:
                    return "Turn limit exceeded."

                combined_tool_responses = []
                for call_data, raw_content, err in calls:
                    if call_data is None:
                        self.ui.display_error(f"\u2696\ufe0f Error de llamada a herramienta: {err}")
                        tr = self.tool_parser.format_tool_response(f"Validation error: {err}", success=False)
                        combined_tool_responses.append(tr)
                        continue

                    name, args = call_data.get("name"), call_data.get("args", {})
                    tr, success = await self.engine.execute_tool_call(name, args, call_data)
                    combined_tool_responses.append(tr)

                combined_message = "\n".join(combined_tool_responses)
                await self._wait_for_rate_limit()

                start_time = time.perf_counter()
                response_obj = await self.assistant.send_message(combined_message, "user")
                self.last_response_time += time.perf_counter() - start_time
                response_text = self._extract_text(response_obj)

            # Prune history if it exceeds the limit to maintain efficiency
            current_tokens = self.assistant.count_tokens(self.assistant.history)
            if current_tokens > self.context_window_limit:
                self.assistant.prune_history(self.context_window_limit)

            return response_text
        except asyncio.CancelledError:
            logger.info("Execution task cancelled.")
            raise
        finally:
            self.ui.stop_all_monitoring()

    async def _processor_loop(self):
        """Background loop that processes the message queue with aggregation logic."""
        while not self.should_exit:
            try:
                user_input = await self.message_queue.get()
                self.ui.update_queue_count(self.message_queue.qsize())
                
                self.current_task = asyncio.create_task(
                    self.execute(user_input, thinking_enabled=self.thinking_enabled)
                )
                
                try:
                    result = await self.current_task
                    self._process_and_display_result(result)
                except asyncio.CancelledError:
                    self.ui.display_emergency_stop()
                except Exception as e:
                    self.ui.display_error(f"Error: {e}")
                finally:
                    self.current_task = None
                    self.message_queue.task_done()

                queued_messages = []
                while not self.message_queue.empty():
                    msg = self.message_queue.get_nowait()
                    queued_messages.append(msg)
                    self.message_queue.task_done()

                if queued_messages:
                    # UX Improvement: Contextual header for aggregated messages
                    header = f"[SYSTEM: The user sent {len(queued_messages)} follow-up messages while you were processing. Please address all of them.]"
                    aggregated_input = f"{header}\n\n" + "\n\n".join(queued_messages)
                    
                    logger.info(f"Aggregating {len(queued_messages)} messages into one turn.")
                    
                    self.current_task = asyncio.create_task(
                        self.execute(aggregated_input, thinking_enabled=self.thinking_enabled)
                    )
                    try:
                        result = await self.current_task
                        self._process_and_display_result(result)
                    except asyncio.CancelledError:
                        self.ui.display_emergency_stop()
                    except Exception as e:
                        self.ui.display_error(f"Error processing aggregated messages: {e}")
                    finally:
                        self.current_task = None
                
                self.ui.update_queue_count(self.message_queue.qsize())

            except Exception as e:
                sanitized_err = self._sanitize_text(str(e))
                logger.error(f"Processor loop error: {sanitized_err}")

    async def run(self, initial_input: Optional[str] = None):
        if not self._initialized_event.is_set():
            await asyncio.to_thread(self._initialize_chat)

        if self._init_error:
            return

        processor = asyncio.create_task(self._processor_loop())

        if initial_input:
            if await self.command_handler.handle(initial_input):
                pass
            else:
                await self.message_queue.put(initial_input)
                self.ui.update_queue_count(self.message_queue.qsize())

        if self.instance_mode:
            await self.message_queue.join()
            processor.cancel()
            return

        while not self.should_exit:
            try:
                user_input = await self.ui.request_input("> ", history=None)

            except Exception as e:
                self.ui.display_error(f"Critical UI Error: {e}")
                break

            if not user_input:
                continue

            if await self.command_handler.handle(user_input):
                continue

            await self.message_queue.put(user_input)
            self.ui.update_queue_count(self.message_queue.qsize())

        processor.cancel()

    def stop_execution(self):
        """Triggers an immediate cancellation of the current AI task."""
        if self.current_task:
            self.current_task.cancel()

    async def _translate_text(self, text: str) -> str:
        prompt = f"Translate the following text to English. Return ONLY the translation: {text}"
        response = await self.assistant.send_message(prompt)
        return self._extract_text(response)

    def _initialize_chat(self) -> None:
        try:
            from src.tools import memory_tools
            memory_tools.set_assistant(self.assistant)
            memory_tools.set_chat_manager(self)
            model = self.config_manager.get("model_name", "models/gemma-4-31b-it")
            self.assistant.start_chat(model, self.system_instruction, self.temperature)
            self._initialized_event.set()
        except Exception as e:
            logger.exception("CRITICAL CHAT INIT ERROR")
            self._init_error = e
