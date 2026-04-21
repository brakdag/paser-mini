import json
import re
import os
import asyncio
import threading
import logging
from typing import Any, Optional, Union

from paser.core.commands import CommandHandler
from paser.core.repetition_detector import RepetitionDetector
from paser.core.config_manager import ConfigManager
from paser.core.tool_parser import ToolParser
from paser.tools import ToolError

class ToolAttemptTracker:
    """Tracks tool calls to detect behavioral loops (exact repetitions or repeated failures)."""
    def __init__(self, max_exact_attempts=5, max_tool_failures=5):
        self.exact_attempts = {}
        self.tool_failures = {}
        self.max_exact_attempts = max_exact_attempts
        self.max_tool_failures = max_tool_failures

    def record_attempt(self, name, args):
        args_json = json.dumps(args, sort_keys=True)
        key = (name, args_json)
        self.exact_attempts[key] = self.exact_attempts.get(key, 0) + 1
        return self.exact_attempts[key] <= self.max_exact_attempts

    def record_failure(self, name):
        self.tool_failures[name] = self.tool_failures.get(name, 0) + 1
        return self.tool_failures[name] <= self.max_tool_failures

    def record_success(self, name):
        self.tool_failures[name] = 0

    def reset(self):
        self.exact_attempts = {}
        self.tool_failures = {}

logger = logging.getLogger("paser")

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
        self.tool_parser = ToolParser()
        
        self.thinking_enabled = self.config_manager.get("thinking_enabled", False)
        self.temperature = float(self.config_manager.get("default_temperature", 0.7))
        self.context_window_limit = int(self.config_manager.get("context_window_limit", 250000))
        self.rpm_limit = int(self.config_manager.get("rpm_limit", 15))
        self.tpm_limit = int(self.config_manager.get("tpm_limit", 15000))
        self.auto_rpm_enabled = self.config_manager.get("auto_rpm_enabled", False)
        self.request_timestamps = []
        
        self.command_handler = CommandHandler(self, ui)
        
        # Executor state
        self.repetition_detector = RepetitionDetector(n=5, max_repeats=5)
        self.tool_tracker = ToolAttemptTracker()
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
            current_tokens = self.assistant.count_tokens(self.assistant.history)
            self.rpm_limit = max(1, int(self.tpm_limit / max(current_tokens, 1000)))
            logger.debug(f"Auto-RPM: Adjusted limit to {self.rpm_limit} (Tokens: {current_tokens}, TPM: {self.tpm_limit})")

        now = asyncio.get_event_loop().time()
        self.request_timestamps = [t for t in self.request_timestamps if now - t < 60]
        
        if len(self.request_timestamps) >= self.rpm_limit:
            wait_time = 60 - (now - self.request_timestamps[0])
            if wait_time > 0:
                logger.warning(f"Rate limit reached. Waiting {wait_time:.2f}s...")
                await asyncio.sleep(wait_time)
                return await self._wait_for_rate_limit()
        
        self.request_timestamps.append(asyncio.get_event_loop().time())

    async def _enforce_context_limit(self):
        if not self.assistant.history:
            return

        if self.assistant.count_tokens(self.assistant.history) > self.context_window_limit:
            logger.info("Context limit reached. Performing Hard Reset to eliminate ghosting...")
            
            from google.genai import types
            from paser.infrastructure.memento.manager import MementoManager
            
            # 1. Re-initialize chat (Clear history)
            self.assistant.start_chat(
                self.assistant._current_model,
                self.system_instruction,
                self.temperature
            )
            
            # 2. Retrieve and inject latest Bridge Block
            manager = MementoManager()
            bridge = manager.get_latest_bridge()
            
            if bridge:
                bridge_msg = f"\n\n[MEMENTO LEAP: AUTOMATIC RESTORED SESSION STATE]\nNode #{bridge['id']} | {bridge['content']}\n"
                self.assistant.history.append(
                    types.Content(
                        role="user",
                        parts=[types.Part.from_text(text=bridge_msg)]
                    )
                )
                logger.info(f"Bridge Block #{bridge['id']} restored automatically.")
            else:
                logger.info("No Bridge Block found. Starting fresh session.")
            
            # 3. Sync SDK
            self.assistant.refresh_session()

    async def _check_memento_triggers(self):
        """
        Monitors token usage and injects system alerts for Distillation (80%) and Bridging (95%).
        """
        history = self.assistant.history
        if not history:
            return

        tokens = self.assistant.count_tokens(history)
        percentage = (tokens / self.context_window_limit) * 100

        trigger_msg = None
        if 80 <= percentage < 95:
            trigger_msg = "⚠️ SYSTEM ALERT: Context usage at 80%. Please perform DISTILLATION: summarize key insights and store them using `push_memory(scope='fractal', ...)`. "
        elif percentage >= 95:
            trigger_msg = "🚨 SYSTEM ALERT: Context usage at 95%. Please generate a BRIDGE BLOCK: summarize the session state and store it using `push_memory` with teaser 'BRIDGE: ...' immediately."

        if trigger_msg and not self._is_last_message_alert(trigger_msg):
            await self._inject_system_alert(trigger_msg)

    def _is_last_message_alert(self, msg):
        if not self.assistant.history:
            return False
        last_msg = self.assistant.history[-1]
        for part in last_msg.parts:
            if hasattr(part, 'text') and msg in part.text:
                return True
        return False

    async def _inject_system_alert(self, msg):
        from google.genai import types
        alert_content = types.Content(
            role="user", 
            parts=[types.Part.from_text(text=f"\n\n[SYSTEM NOTIFICATION]\n{msg}\n")]
        )
        self.assistant.history.append(alert_content)
        self.assistant.refresh_session()
        logger.info(f"Memento trigger injected: {msg}")

    def _extract_text(self, response) -> str:
        return response.text if hasattr(response, "text") and response.text else str(response)

    async def execute(self, user_input: Union[str, bytes], thinking_enabled: bool = True, get_confirmation_callback=None) -> str:
        self.stop_requested = False
        self.turn_count = 0
        self.tool_tracker.reset()
        self.turn_count += 1
        if self.turn_count > self.max_turns:
            return "Turn limit exceeded."
        
        if isinstance(user_input, str):
            rep_res = self.repetition_detector.add_text(user_input)
            if rep_res is not True:
                return f"Repetitive text detected: possible infinite loop. Sequence: '{rep_res}'"
        
        try:
            await self._wait_for_rate_limit()
            await self._enforce_context_limit()
            await self._check_memento_triggers()
            response = await asyncio.to_thread(self.assistant.send_message, user_input)
            response_text = self._extract_text(response)
            
            while True:
                if self.stop_requested:
                    raise EmergencyStopException("Execution interrupted by user.")
                
                rep_res = self.repetition_detector.add_text(response_text)
                if rep_res is not True:
                    return f"Repetitive text detected: possible infinite loop. Sequence: '{rep_res}'"
                
                calls = self.tool_parser.extract_tool_calls(response_text)
                
                if not calls: break
                
                self.turn_count += 1
                if self.turn_count > self.max_turns: return "Turn limit exceeded."
                
                combined_tool_responses = []
                for call_data, raw_content in calls:
                    if self.stop_requested:
                        raise EmergencyStopException("Ejecución interrumpida por el usuario.")

                    if call_data is None:
                        combined_tool_responses.append(self.tool_parser.format_tool_response(f"Error de sintaxis: {raw_content}", success=False))
                        continue
                    
                    name, args = call_data.get("name"), call_data.get("args", {})
                    
                    if not self.tool_tracker.record_attempt(name, args):
                        return f"Tool loop detected: the tool '{name}' has been called too many times with the same arguments."

                    # Extract detail for monitoring
                    detail = ""
                    if name in ["read_file", "write_file", "remove_file", "replace_string"]:
                        path = args.get("path", "")
                        detail = os.path.basename(path) if path else ""
                    elif name in ["list_dir", "create_dir"]:
                        detail = args.get("path", "")
                    elif name == "rename_path":
                        orig = os.path.basename(args.get("origen", ""))
                        dest = os.path.basename(args.get("destino", ""))
                        detail = f"{orig} -> {dest}"
                    elif name in ["push_memory", "pull_memory"]:
                        detail = args.get("key", "unknown")
                    elif name == "run_instance":
                        detail = args.get("target", "unknown")
                    elif name == "search_text_global":
                        detail = f"'{args.get('query', '')}'"
                    elif name == "search_files_pattern":
                        detail = f"pattern: {args.get('pattern', '')}"
                    
                    self.ui.start_tool_monitoring(name, detail)
                    
                    # Yield to the event loop to allow the spinner to render its first frame
                    await asyncio.sleep(0)
                    
                    start_time = asyncio.get_event_loop().time()
                    
                    if name in self.tools:
                        if name == "run_instance" and self.instance_mode:
                            tr = self.tool_parser.format_tool_response("ERR: Recursion is disabled in this instance to prevent infinite loops.", call_id=call_data.get("id"), success=False)
                            success = False
                        else:
                            try:
                                # Memento Notifications
                                if name == "pull_memory":
                                    key = args.get("key")
                                    if key:
                                        is_first = key not in self.session_accessed_nodes
                                        self.session_accessed_nodes.add(key)
                                        self.ui.display_message(f"🧠 **Memento Pull**: Accessing node #{key} {'(First time)' if is_first else '(Cached)'}")
                                
                                result = await asyncio.to_thread(self.tools[name], **args)
                                
                                if name == "push_memory":
                                    self.ui.display_message(f"✍️ **Memento Push**: {result}")
                                
                                # Visualización especial para la instancia de prueba
                                if name == "run_instance":
                                    self.ui.display_message(f"**🚀 Instance Test Output**\n\n```text\n{result}\n```")
                                
                                self.tool_tracker.record_success(name)
                                tr = self.tool_parser.format_tool_response(result, call_id=call_data.get("id"), success=True)
                                success = True
                            except ToolError as te:
                                if not self.tool_tracker.record_failure(name):
                                    return f"Error loop detected: the tool '{name}' has failed repeatedly."
                                tr = self.tool_parser.format_tool_response(f"ERR: {str(te)}", call_id=call_data.get("id"), success=False)
                                success = False
                            except Exception as exc:
                                if not self.tool_tracker.record_failure(name):
                                    return f"Error loop detected: the tool '{name}' has failed repeatedly."
                                tr = self.tool_parser.format_tool_response(f"ERR: Unexpected error: {str(exc)}", call_id=call_data.get("id"), success=False)
                                success = False
                    else:
                        tr = self.tool_parser.format_tool_response(f"Herramienta desconocida: {name}", call_id=call_data.get("id"), success=False)
                        success = False
                    
                    # Ensure the spinner is visible for at least 300ms for better UX
                    # Removed artificial delay for execution speed
                    # elapsed = asyncio.get_event_loop().time() - start_time
                    # if elapsed < 0.3:
                    #     await asyncio.sleep(0.3 - elapsed)
                    
                    self.ui.end_tool_monitoring(name, success=success, detail=detail)
                    combined_tool_responses.append(tr)
                
                combined_message = "".join(combined_tool_responses)
                await self._wait_for_rate_limit()
                await self._enforce_context_limit()
                await self._check_memento_triggers()
                response_obj = await asyncio.to_thread(self.assistant.send_message, combined_message)
                response_text = self._extract_text(response_obj)
                
            return response_text
        finally:
            self.ui.stop_all_monitoring()

    async def execute_single(self, user_input: str) -> str:
        result = await self.execute(
            user_input=user_input, 
            thinking_enabled=self.thinking_enabled
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
                        get_confirmation_callback=self.ui.request_input
                    )
                    if result:
                        cleaned_result = self.tool_parser.clean_response(result)
                        self.ui.add_spacing()
                        self.ui.display_message(cleaned_result)
                    self.ui.add_spacing()
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
            if not user_input: continue
            if await self.command_handler.handle(user_input): continue
            try:
                result = await self.execute(
                    user_input=user_input, 
                    thinking_enabled=self.thinking_enabled, 
                    get_confirmation_callback=self.ui.request_input
                )
                if result:
                    cleaned_result = self.tool_parser.clean_response(result)
                    self.ui.add_spacing()
                    self.ui.display_message(cleaned_result)
                
                self.ui.add_spacing()
            except EmergencyStopException:
                self.ui.display_emergency_stop()
                current_intervention = await self.ui.request_input("> ")
            except Exception as e: 
                self.ui.display_error(f"Error: {e}")
                self.ui.add_spacing()

    def _initialize_chat(self):
        try:
            from paser.tools import memory_tools
            memory_tools.set_assistant(self.assistant)
            memory_tools.set_chat_manager(self)
            
            self.assistant.start_chat(self.config_manager.get("model_name", "models/gemma-4-31b-it"), self.system_instruction, self.temperature)
            self._initialized_event.set()
        except Exception as e: self._init_error = e
