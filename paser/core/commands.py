import os
import json
from paser.core.ui_interface import UserInterface

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
        if input_stripped.lower() in (':q', '/q', '/quit', '/exit'):
            self.chat_manager.should_exit = True
            return True

        # Guardado de historial (Langchain)
        elif input_stripped == '/s':
            if self.chat_manager.assistant.save_snapshot():
                self.ui.display_info("Last interaction saved to current directory")
            else:
                self.ui.display_info("No interaction found to save.")
            return True

        elif input_stripped == '/t':
            history = self.chat_manager.assistant.get_chat_history()
            tokens = self.chat_manager.assistant.count_tokens(history)
            self.ui.display_info(f"Context window: {tokens} tokens")
            return True

        elif input_stripped == '/sandbox':
            current_mode = self.chat_manager.config_manager.get("sandbox_mode", False)
            new_mode = not current_mode
            self.chat_manager.save_config("sandbox_mode", new_mode)
            mode_str = "ENABLED (Wasmer)" if new_mode else "DISABLED (VENV)"
            self.ui.display_info(f"Sandbox mode is now {mode_str}")
            return True

        elif input_stripped.startswith('/w'):
            parts = input_stripped.split()
            if len(parts) != 3:
                self.ui.display_error("Usage: /w <tokens> <rpm_limit>")
                return True
            try:
                tokens = int(parts[1])
                rpm = int(parts[2])
                self.chat_manager.save_config("context_window_limit", tokens)
                self.chat_manager.save_config("rpm_limit", rpm)
                self.chat_manager.context_window_limit = tokens
                self.chat_manager.rpm_limit = rpm
                self.ui.display_info(f"Context window set to {tokens} tokens | RPM limit set to {rpm}")
            except ValueError:
                self.ui.display_error("Tokens and RPM must be integers.")
            return True

        elif input_stripped == '/reset':
            from google.genai import types
            from paser.infrastructure.memento.manager import MementoManager
            from paser.tools.file_tools import clear_read_cache
            
            self.ui.display_info("Performing Hard Reset (The Leap)...")
            
            # Clear file read cache to prevent 'No changes since last read' errors
            clear_read_cache()
            
                        # 1. Re-initialize chat to restore system prompt and clear history
            assistant = self.chat_manager.assistant
            assistant.start_chat(
                assistant._current_model,
                assistant.system_instruction,
                assistant.temperature
            )
            
            # 2. Retrieve latest Bridge Block
            manager = MementoManager()
            bridge = manager.get_latest_bridge()
            
            if bridge:
                # Inject bridge as a system notification
                bridge_msg = f"\n\n[MEMENTO LEAP: RESTORED SESSION STATE]\nNode #{bridge['id']} | {bridge['content']}\n"
                assistant.history.append(
                    types.Content(
                        role="user",
                        parts=[types.Part.from_text(text=bridge_msg)]
                    )
                )
                self.ui.display_info(f"Bridge Block #{bridge['id']} restored.")
            else:
                self.ui.display_info("No Bridge Block found. Starting fresh.")
            
                        # 3. Refresh session to synchronize SDK
            assistant.refresh_session()
            return True

        elif input_stripped.startswith('/tpm'):
            parts = input_stripped.split()
            if len(parts) != 2:
                self.ui.display_error("Usage: /tpm <TPM> (0 to disable)")
                return True
            try:
                tpm = int(parts[1])
                if tpm == 0:
                    self.chat_manager.save_config("auto_rpm_enabled", False)
                    self.chat_manager.auto_rpm_enabled = False
                    # Restore the fixed RPM limit from configuration
                    self.chat_manager.rpm_limit = self.chat_manager.config_manager.get("rpm_limit", 15)
                    self.ui.display_info(f"Auto-RPM disabled. RPM limit restored to {self.chat_manager.rpm_limit}.")
                else:
                    self.chat_manager.save_config("tpm_limit", tpm)
                    self.chat_manager.save_config("auto_rpm_enabled", True)
                    self.chat_manager.tpm_limit = tpm
                    self.chat_manager.auto_rpm_enabled = True
                    self.ui.display_info(f"Auto-RPM enabled. Target TPM: {tpm}. RPM will adjust dynamically.")
            except ValueError:
                self.ui.display_error("TPM must be an integer.")
            return True

        elif input_stripped.startswith('/timeout'):
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

        elif input_stripped == '/clear':
            os.system('cls' if os.name == 'nt' else 'clear')
            return True

        elif input_stripped == '/config':
            config_info = (
                f"Model: {self.chat_manager.assistant._current_model}\n"
                f"Temperature: {self.chat_manager.temperature}\n"
                f"Context Window: {self.chat_manager.context_window_limit} tokens\n"
                f"TPM Limit: {self.chat_manager.tpm_limit}\n"
                f"Instance Timeout: {self.chat_manager.config_manager.get('instance_timeout', 300)}s\n"
                f"Sandbox Mode: {'ENABLED (Wasmer)' if self.chat_manager.config_manager.get('sandbox_mode', False) else 'DISABLED (VENV)'}"
            )
            self.ui.display_panel("Current Configuration", config_info, style="blue")
            return True

        elif input_stripped == '/timestamps':
            current = self.chat_manager.config_manager.get("timestamps_enabled", False)
            new_val = not current
            self.chat_manager.save_config("timestamps_enabled", new_val)
            self.chat_manager.timestamps_enabled = new_val
            status = "ENABLED" if new_val else "DISABLED"
            self.ui.display_info(f"Response timestamps are now {status}")
            return True

        elif input_stripped == '/help':
            help_text = (
                "```\n"
                "Available Commands:\n"
                "-------------------\n"
                "/help     - Show this help menu\n"
                "/config    - Show current system configuration\n"
                "/models   - Change AI model and temperature\n"
                "/sandbox  - Toggle WebAssembly sandbox mode\n"
                "/s        - Save a snapshot of the last interaction\n"
                "/t        - Display current context window token count\n"
                "/timeout  - Set the timeout for run_instance (e.g., /timeout 600)\n"
                "/timestamps - Toggle response time display\n"
                "/tpm      - Set Auto RPM based on TPM (e.g., /tpm 15000)\n"
                "/reset    - Hard Reset: Clear history and Leap via Bridge Block\n"
                "/q, /quit, /exit - Exit the application\n"
                "```"
            )
            self.ui.display_message(help_text)
            return True

        # Configuración del Agente
        elif input_stripped == '/connect':
            from paser.infrastructure.gemini.adapter import GeminiAdapter
            from paser.infrastructure.nvidia.adapter import NvidiaAdapter
            
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

        elif input_stripped.startswith('/shadow'):
            parts = input_stripped.split()
            if len(parts) != 2:
                self.ui.display_error("Usage: /shadow <model_name> (e.g., /shadow meta/llama-4-scout-17b-16e-instruct)")
                return True
            
            model_name = parts[1]
            
            # 1. Determine Temperature
            temp_input = await self.ui.request_input(f"Temp (0-1, default {self.chat_manager.temperature}): ")
            try:
                new_temp = float(temp_input or self.chat_manager.temperature)
            except ValueError:
                self.ui.display_error("Invalid temperature. Using default.")
                new_temp = self.chat_manager.temperature

            # 2. Persist and Apply
            self.chat_manager.save_config("model_name", model_name)
            self.chat_manager.save_config("default_temperature", new_temp)
            self.chat_manager.temperature = new_temp
            self.chat_manager.assistant.start_chat(model_name, self.chat_manager.system_instruction, new_temp)
            
            self.ui.display_info(f"Connected to shadow model {model_name} | Temperature: {new_temp}")
            return True

        elif input_stripped.startswith('/models'):
            parts = input_stripped.split()
            models = self.chat_manager.assistant.get_available_models()
            
            # 1. Determine Model
            if len(parts) == 1:
                header = "| ID | Model | ID | Model |\n|---|---|---|---|\n"
                rows = []
                for i in range(0, len(models), 2):
                    m1 = models[i]
                    m2 = models[i+1] if i+1 < len(models) else ""
                    idx2 = str(i+1) if i+1 < len(models) else ""
                    rows.append(f"| {i} | {m1} | {idx2} | {m2} |")
                self.ui.display_message(f"Available models:\n\n{header}" + "\n".join(rows))
                choice = await self.ui.request_input("Modelo: ")
                try:
                    idx = int(choice)
                    model_name = models[idx]
                except (ValueError, IndexError):
                    self.ui.display_error("Invalid model index.")
                    return True
            else:
                try:
                    idx = int(parts[1])
                    model_name = models[idx]
                except (ValueError, IndexError):
                    self.ui.display_error("Invalid model index provided.")
                    return True

            # 2. Determine Temperature
            if len(parts) >= 3:
                try:
                    new_temp = float(parts[2])
                except ValueError:
                    self.ui.display_error("Invalid temperature. Using default.")
                    new_temp = self.chat_manager.temperature
            else:
                temp_input = await self.ui.request_input(f"Temp (0-1, default {self.chat_manager.temperature}): ")
                try:
                    new_temp = float(temp_input or self.chat_manager.temperature)
                except ValueError:
                    self.ui.display_error("Invalid temperature. Using default.")
                    new_temp = self.chat_manager.temperature

            # 3. Persist and Apply
            self.chat_manager.save_config("model_name", model_name)
            self.chat_manager.save_config("default_temperature", new_temp)
            self.chat_manager.temperature = new_temp
            self.chat_manager.assistant.start_chat(model_name, self.chat_manager.system_instruction, new_temp)
            
            self.ui.display_info(f"Modelo cambiado a {model_name} | Temperatura: {new_temp}")
            return True

        if input_stripped.startswith('/') or input_stripped.startswith(':'):
            self.ui.display_error("Comando no válido")
            return True

        return False
