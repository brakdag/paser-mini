import os
import json
import asyncio
from src.core.ui_interface import UserInterface


class CommandHandler:
    def __init__(self, chat_manager, ui: UserInterface):
        self.chat_manager = chat_manager
        self.ui = ui
        self.history = []

    def log_tool(self, name, status):
        self.history.append({"name": name, "status": status})

    async def handle(self, user_input):
        input_stripped = user_input.strip()

        # Salida
        from src.core.command_handlers.system import SystemCommands

        if input_stripped.lower() in (":q", "/q", "/quit", "/exit"):
            return SystemCommands.handle_exit(self.chat_manager)

        # Guardado de historial (Langchain)
        elif input_stripped == "/s":
            if self.chat_manager.assistant.save_snapshot():
                self.ui.display_info("Last interaction saved to current directory")
            else:
                self.ui.display_info("No interaction found to save.")
            return True

        elif input_stripped == "/sandbox":
            current_mode = self.chat_manager.config_manager.get("sandbox_mode", False)
            new_mode = not current_mode
            self.chat_manager.save_config("sandbox_mode", new_mode)
            mode_str = "ENABLED (Wasmer)" if new_mode else "DISABLED (VENV)"
            self.ui.display_info(f"Sandbox mode is now {mode_str}")
            return True

        elif input_stripped == "/safemode":
            current_mode = self.chat_manager.config_manager.get("safemode", False)
            new_mode = not current_mode
            self.chat_manager.save_config("safemode", new_mode)
            self.chat_manager.safemode = new_mode
            mode_str = "ENABLED" if new_mode else "DISABLED"
            self.ui.display_info(f"Safe Mode is now {mode_str}")
            return True

        elif input_stripped.startswith("/w"):
            parts = input_stripped.split()
            if len(parts) != 4:
                self.ui.display_error("Usage: /w <tokens> <rpm_limit> <tpm_limit>")
                return True
            try:
                tokens = int(parts[1])
                rpm = int(parts[2])
                tpm = int(parts[3])
                self.chat_manager.save_config("context_window_limit", tokens)
                self.chat_manager.save_config("rpm_limit", rpm)
                self.chat_manager.save_config("tpm_limit", tpm)
                self.chat_manager.save_config("auto_rpm_enabled", tpm > 0)
                self.chat_manager.context_window_limit = tokens
                self.chat_manager.rpm_limit = rpm
                self.chat_manager.tpm_limit = tpm
                self.chat_manager.auto_rpm_enabled = tpm > 0
                self.ui.display_info(
                    f"Context window: {tokens} | RPM: {rpm} | TPM: {tpm} | Auto-RPM: {'ON' if tpm > 0 else 'OFF'}"
                )
            except ValueError:
                self.ui.display_error("Tokens, RPM, and TPM must be integers.")
            return True

        elif input_stripped == "/reset":
            from src.infrastructure.memento.manager import MementoManager
            from src.tools.file_tools import clear_read_cache

            self.ui.display_info("Performing Hard Reset (The Leap)...")

            # Clear file read cache to prevent 'No changes since last read' errors
            clear_read_cache()

            # 1. Retrieve latest Bridge Block from Memento
            manager = MementoManager()
            bridge = await manager.get_latest_bridge()

            new_history = []
            if bridge:
                bridge_msg = f"[MEMENTO LEAP: RESTORED SESSION STATE]\nNode #{bridge['id']} | {bridge['content']}"
                new_history.append({"role": "user", "parts": [{"text": bridge_msg}]})
                self.ui.display_info(f"Bridge Block #{bridge['id']} restored.")
            else:
                self.ui.display_info("No Bridge Block found. Starting fresh.")

            # 2. Perform Hard Reset on Assistant
            assistant = self.chat_manager.assistant
            assistant.hard_reset(history_override=new_history)
            return True

        elif input_stripped.startswith("/r "):
            new_message = input_stripped[3:].strip()
            history = self.chat_manager.assistant.get_history()
            if len(history) >= 2:
                history.pop()
                history.pop()
                self.ui.display_info("Last interaction removed. Reprompting...")
                # Reset tool tracker and state before re-running
                self.chat_manager.tool_tracker.reset()
                self.chat_manager.turn_count = 0
                self.chat_manager.should_exit = False
                await self.chat_manager.run(initial_input=new_message)
                self.chat_manager.should_exit = True
            else:
                self.ui.display_error("No interaction to remove.")
            return True

        elif input_stripped.startswith("/en") or input_stripped.startswith("/eng"):
            # Determine which prefix was used to slice correctly
            prefix_len = 4 if input_stripped.startswith("/en") else 5
            text_to_translate = input_stripped[prefix_len:].strip()

            if text_to_translate:
                # Mode 1: Specific Text Translation
                prompt = f"Translate the following text to English. Return ONLY the translation: {text_to_translate}"
                translated = await self.chat_manager.execute_single(prompt)
                self.ui.display_info(f"Translated: {translated}")
                self.chat_manager.assistant.send_message(translated, role="user")
            else:
                # Mode 2: Massive Context Translation
                self.ui.display_info("Translating entire context window to English... Please wait.")
                history = self.chat_manager.assistant.get_history()
                if not history:
                    self.ui.display_error("No history to translate.")
                else:
                    translation_prompt = (
                        "Translate the following conversation history to English. "
                        "Maintain the exact JSON structure: a list of objects with 'role' and 'parts' "
                        "(where 'parts' is a list of objects with 'text'). "
                        "Return ONLY the raw JSON array. Do not add markdown formatting, backticks, or explanations.\n\n"
                        f"History: {json.dumps(history, ensure_ascii=False)}"
                    )
                    try:
                        translated_json_str = await self.chat_manager.execute_single(translation_prompt)
                        # Clean potential markdown backticks if the LLM ignored instructions
                        cleaned_json = translated_json_str.strip().removeprefix('```json').removeprefix('```').removesuffix('```').strip()
                        translated_history = json.loads(cleaned_json)
                        
                        if isinstance(translated_history, list):
                            self.chat_manager.assistant.hard_reset(history_override=translated_history)
                            self.ui.display_info("Context window successfully translated to English.")
                        else:
                            raise ValueError("Translated content is not a list.")
                    except Exception as e:
                        self.ui.display_error(f"Failed to translate context: {e}")
            return True

        elif input_stripped.startswith("/timeout"):
            parts = input_stripped.split()
            if len(parts) != 2:
                self.ui.display_error("Usage: /timeout <seconds>")
                return True
            try:
                timeout = int(parts[1])
                self.chat_manager.save_config("instance_timeout", timeout)
                self.ui.display_info(f"Instance timeout set to {timeout} seconds.")
            except ValueError:
                self.ui.display_error("Timeout must be an integer.")
            return True

        elif input_stripped == "/clear":
            from src.core.command_handlers.system import SystemCommands

            return SystemCommands.handle_clear(self.ui)

        elif input_stripped == "/config":
            from src.core.command_handlers.config import ConfigCommands

            return ConfigCommands.handle_config(self.chat_manager, self.ui)

        elif input_stripped == "/timestamps":
            current = self.chat_manager.config_manager.get("timestamps_enabled", False)
            new_val = not current
            self.chat_manager.save_config("timestamps_enabled", new_val)
            self.chat_manager.timestamps_enabled = new_val
            status = "ENABLED" if new_val else "DISABLED"
            self.ui.display_info(f"Response timestamps are now {status}")
            return True

        elif input_stripped == "/help":
            help_text = (
                "```\n"
                "Available Commands:\n"
                "-------------------\n"
                "/help       - Show this help menu\n"
                "/config     - Show current system configuration\n"
                "/models     - Change AI model and temperature\n"
                "/models_check - Verify model availability and cache results\n"
                "/fav        - Manage favorite models (/fav, /fav+, /fav -<idx>, /fav <idx>)\n"
                "/sandbox    - Toggle WebAssembly sandbox mode\n"
                "/safemode   - Toggle Safe Mode (restricts dangerous tools)\n"
                "/s          - Save a snapshot of the last interaction\n"
                "/timeout    - Set the timeout for run_instance (e.g., /timeout 600)\n"
                "/timestamps - Toggle response time display\n"
                "/w          - Set window, RPM, and TPM (e.g., /w 250000 15 15000)\n"
                "/reset      - Hard Reset: Clear history and Leap via Bridge Block\n"
                "/r <msg>    - Rewrite: Remove last interaction and re-prompt\n"
                "/eng        - Translate text or entire context window to English\n"
                "/connect    - Switch between AI providers (Gemini/NVIDIA)\n"
                "/shadow     - Connect to a specific shadow model\n"
                "/q, /quit, /exit - Exit the application\n"
                "```"
            )
            self.ui.display_message(help_text)
            return True

        # Configuración del Agente
        elif input_stripped == "/connect":
            from src.infrastructure.gemini.adapter import GeminiAdapter
            from src.infrastructure.nvidia.adapter import NvidiaAdapter

            providers = {"Gemini": GeminiAdapter, "NVIDIA": NvidiaAdapter}
            self.ui.display_message("Select Provider:\n0: Gemini\n1: NVIDIA")
            choice = await self.ui.request_input("Provider: ")

            if choice == "0":
                self.chat_manager.assistant = GeminiAdapter()
                self.chat_manager.save_config("provider", "Gemini")
            elif choice == "1":
                self.chat_manager.assistant = NvidiaAdapter()
                self.chat_manager.save_config("provider", "NVIDIA")
            else:
                self.ui.display_error("Invalid provider.")
                return True

            self.ui.display_info(f"Connected to {list(providers.keys())[int(choice)]}")
            return True

        elif input_stripped.startswith("/shadow"):
            parts = input_stripped.split()
            if len(parts) != 2:
                self.ui.display_error(
                    "Usage: /shadow <model_name> (e.g., /shadow meta/llama-4-scout-17b-16e-instruct)"
                )
                return True

            model_name = parts[1]

            # 1. Determine Temperature
            temp_input = await self.ui.request_input(
                f"Temp (0-1, default {self.chat_manager.temperature}): "
            )
            try:
                new_temp = float(temp_input or self.chat_manager.temperature)
            except ValueError:
                self.ui.display_error("Invalid temperature. Using default.")
                new_temp = self.chat_manager.temperature

            # 2. Persist and Apply
            self.chat_manager.save_config("model_name", model_name)
            self.chat_manager.save_config("default_temperature", new_temp)
            self.chat_manager.temperature = new_temp
            self.chat_manager.assistant.start_chat(
                model_name, self.chat_manager.system_instruction, new_temp
            )

            self.ui.display_info(
                f"Connected to shadow model {model_name} | Temperature: {new_temp}"
            )
            return True

        elif input_stripped == "/models_check":
            """
            Model Availability Check Logic:
            We iterate through all available models and attempt a minimal completion request.
            - If a model returns 404, it is marked as unavailable.
            - If a model times out (>= 2s), we assume it is available but slow, so we skip marking it as unavailable.
            - If a model returns any other error (e.g., 400 Bad Request), we treat it as available to avoid false negatives.
            This approach prioritizes speed and prevents the check from hanging on slow or misconfigured models.
            """
            models = await self.chat_manager.assistant.get_available_models()
            unavailable = []
            self.ui.display_info(
                f"Checking availability for {len(models)} models... (This may take a while)"
            )

            # Simple progress bar
            for i, model in enumerate(models):
                percent = (i + 1) / len(models) * 100
                bar = "█" * int(percent / 5) + "-" * (20 - int(percent / 5))
                print(f"\rChecking models: [{bar}] {int(percent)}%", end="", flush=True)

                try:
                    is_available = await asyncio.wait_for(
                        self.chat_manager.assistant.check_availability(model),
                        timeout=2.0,
                    )
                    if not is_available:
                        unavailable.append(model)
                except (asyncio.TimeoutError, Exception):
                    # Si hay timeout o error (como 400), asumimos disponible para no bloquear
                    pass
            print() # New line after progress bar

            self.chat_manager.save_config("unavailable_models", unavailable)
            self.ui.display_panel(
                "Availability Check",
                f"Found {len(unavailable)} unavailable models. Cache updated.",
                style="yellow",
            )
            return True

        elif input_stripped.startswith("/models"):
            from src.core.command_handlers.models import ModelCommands

            return await ModelCommands.handle_models(
                self.chat_manager, self.ui, input_stripped.split()
            )

        elif input_stripped.startswith("/fav"):
            from src.core.command_handlers.favorites import FavoriteCommands

            if input_stripped.startswith("/fav+"):
                parts = ["/fav", "+"]
            else:
                parts = input_stripped.split()
            return FavoriteCommands.handle_fav(self.chat_manager, self.ui, parts)

        if input_stripped.startswith("/") or input_stripped.startswith(":"):
            self.ui.display_error("Comando no válido")
            return True

        return False
