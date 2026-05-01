import json
import re
import os
import asyncio
import threading
import logging
import time
from typing import Any, Optional, Union, Callable
from collections import deque

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
        self.rpm_limit = int(self.config_manager.get("rpm_limit", 15))
        self.tpm_limit = int(self.config_manager.get("tpm_limit", 15000))
        self.auto_rpm_enabled = self.config_manager.get("auto_rpm_enabled", False)
        self.timestamps_enabled = self.config_manager.get("timestamps_enabled", False)
        self.safemode = self.config_manager.get("safemode", False)
        self.last_response_time = 0
        self.request_timestamps = deque()

        self.command_handler = CommandHandler(self, ui)

        # Executor state
        self.repetition_detector = RepetitionDetector(n=5, max_repeats=5)
        self.engine = ExecutionEngine(
            self.assistant, self.tools, self.tool_parser, self.ui, self.instance_mode
        )
        self.session_accessed_nodes = set()
        self.max_turns = 10000
        self.turn_count = 0
        self.stop_requested = False

        self.should_exit = False
        self._initialized_event = threading.Event()
        self._init_error = None

    def save_config(self, key, value):
        if self.instance_mode:
            # Only update in memory for child instances
            self.config_manager.config[key] = value
            return
        self.config_manager.save(key, value)

    async def _wait_for_rate_limit(self):
        if self.auto_rpm_enabled:
            current_tokens = getattr(self.assistant, "_cached_tokens", 1000)
            self.rpm_limit = max(1, int(self.tpm_limit / max(current_tokens, 1000)))
            logger.debug(
                f"Auto-RPM: Adjusted limit to {self.rpm_limit} (Cached Tokens: {current_tokens}, TPM: {self.tpm_limit})"
            )

        now = asyncio.get_event_loop().time()
        min_interval = 60.0 / self.rpm_limit

        if self.request_timestamps:
            last_request_time = self.request_timestamps[-1]
            elapsed = now - last_request_time
            if elapsed < min_interval:
                wait_time = min_interval - elapsed
                logger.debug(f"Rate limiting: spacing requests. Waiting {wait_time:.2f}s...")
                await asyncio.sleep(wait_time)
                now = asyncio.get_event_loop().time()

        self.request_timestamps.append(now)
        if len(self.request_timestamps) > 1:
            self.request_timestamps.popleft()

    def _extract_text(self, response) -> str:
        return (
            response.text
            if hasattr(response, "text") and response.text
            else str(response)
        )

    def _process_and_display_result(self, result: str) -> None:
        """Cleans and displays the assistant's response to the UI."""
        if not result:
            return

        cleaned_result = self.tool_parser.clean_response(result)
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
        self.stop_requested = False
        self.turn_count = 1
        self.engine.tool_tracker.reset()
        self.last_response_time = 0.0
        if self.turn_count > self.max_turns:
            return "Turn limit exceeded."

        if isinstance(user_input, str):
            rep_res = self.repetition_detector.add_text(user_input)
            if rep_res is not True:
                return f"Repetitive text detected: possible infinite loop. Sequence: '{rep_res}'"

        try:
            await self._wait_for_rate_limit()

            start_time = time.perf_counter()
            response = await asyncio.to_thread(self.assistant.send_message, user_input)
            self.last_response_time += time.perf_counter() - start_time
            response_text = self._extract_text(response)

            while True:
                if self.stop_requested:
                    raise EmergencyStopException("Execution interrupted by user.")

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
                    if self.stop_requested:
                        raise EmergencyStopException(
                            "Ejecución interrumpida por el usuario."
                        )

                    if call_data is None:
                        self.assistant.pop_last_message()
                        self.ui.display_error("⚠️ Glitch detectado: comando mal formado descartado para mantener la estabilidad.")
                        return "Error: Se detectó un comando mal formado y la sesión ha sido sanitizada. Por favor, intenta tu petición de nuevo."

                    name, args = call_data.get("name"), call_data.get("args", {})
                    tr, success = await self.engine.execute_tool_call(
                        name, args, call_data
                    )
                    combined_tool_responses.append(tr)

                combined_message = "\n".join(combined_tool_responses)
                await self._wait_for_rate_limit()

                start_time = time.perf_counter()
                response_obj = await asyncio.to_thread(
                    self.assistant.send_message, combined_message, "user"
                )
                self.last_response_time += time.perf_counter() - start_time
                response_text = self._extract_text(response_obj)

            return response_text
        finally:
            self.ui.stop_all_monitoring()

    async def execute_single(self, user_input: str) -> str:
        result = await self.execute(
            user_input=user_input, thinking_enabled=self.thinking_enabled
        )
        return self.tool_parser.clean_response(result) if result else ""

    async def run(self, initial_input: Optional[str] = None):
        if not self._initialized_event.is_set():
            await asyncio.to_thread(self._initialize_chat)

        if self._init_error:
            return

        current_intervention = None

        if initial_input:
            if await self.command_handler.handle(initial_input):
                pass
            else:
                try:
                    result = await self.execute(
                        user_input=initial_input,
                        thinking_enabled=self.thinking_enabled,
                        get_confirmation_callback=self.ui.request_input,
                    )
                    self._process_and_display_result(result)
                except EmergencyStopException:
                    self.ui.display_emergency_stop()
                    current_intervention = await self.ui.request_input("> ")
                except Exception as e:
                    self.ui.display_error(f"Error processing initial message: {e}")
                    self.ui.add_spacing()

        if self.instance_mode:
            return

        while not self.should_exit:
            try:
                if current_intervention:
                    user_input = current_intervention
                    current_intervention = None
                else:
                    user_input = await self.ui.request_input("> ", history=None)

            except Exception as e:
                self.ui.display_error(f"Critical UI Error: {e}")
                break
            if not user_input:
                continue
            if await self.command_handler.handle(user_input):
                continue
            try:
                result = await self.execute(
                    user_input=user_input,
                    thinking_enabled=self.thinking_enabled,
                    get_confirmation_callback=self.ui.request_input,
                )
                self._process_and_display_result(result)
            except EmergencyStopException:
                self.ui.display_emergency_stop()
                current_intervention = await self.ui.request_input("> ")
            except Exception as e:
                self.ui.display_error(f"Error: {e}")
                self.ui.add_spacing()

    async def _translate_text(self, text: str) -> str:
        """Translates text without affecting the main chat history."""
        prompt = f"Translate the following text to English. Return ONLY the translation: {text}"
        # Use a temporary execution to avoid history pollution
        response = await asyncio.to_thread(self.assistant.send_message, prompt)
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
