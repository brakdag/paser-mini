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
            from src.infrastructure.gemini.utils import estimate_tokens
            history = self.chat_manager.assistant.get_chat_history()
            real_tokens = self.chat_manager.assistant.count_tokens(history)
            est_tokens = estimate_tokens(history)
            self.ui.display_info(f"Context window: [{real_tokens}, {est_tokens}] tokens (API, Local)")
            return True

        elif input_stripped == '/sandbox':
            current_mode = self.chat_manager.config_manager.get("sandbox_mode", False)
            new_mode = not current_mode
            self.chat_manager.save_config("sandbox_mode", new_mode)
            mode_str = "ENABLED (Wasmer)" if new_mode else "DISABLED (VENV)"
            self.ui.display_info(f"Sandbox mode is now {mode_str}")
            return True

        elif input_stripped == '/safemode':
            current_mode = self.chat_manager.config_manager.get("safemode", False)
            new_mode = not current_mode
            self.chat_manager.save_config("safemode", new_mode)
            self.chat_manager.safemode = new_mode
            mode_str = "ENABLED" if new_mode else "DISABLED"
            self.ui.display_info(f"Safe Mode is now {mode_str}")
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
            from src.infrastructure.memento.manager import MementoManager
            from src.tools.file_tools import clear_read_cache
            
            self.ui.display_info("Performing Hard Reset (The Leap)...")
            
            # Clear file read cache to prevent 'No changes since last read' errors
            clear_read_cache()
            
            # 1. Retrieve latest Bridge Block from Memento
            manager = MementoManager()
            bridge = manager.get_latest_bridge()
            
            new_history = []
            if bridge:
                bridge_msg = f"[MEMENTO LEAP: RESTORED SESSION STATE]\nNode #{bridge['id']} | {bridge['content']}"
                new_history.append(
                    types.Content(
                        role="user",
                        parts=[types.Part.from_text(text=bridge_msg)]
                    )
                )
                self.ui.display_info(f"Bridge Block #{bridge['id']} restored.")
            else:
                self.ui.display_info("No Bridge Block found. Starting fresh.")
            
            # 2. Perform Hard Reset on Assistant
            assistant = self.chat_manager.assistant
            assistant.hard_reset(history_override=new_history)
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
                "| Setting | Value |\n"
                "| :--- | :--- |\n"
                f"| Model | {self.chat_manager.assistant._current_model} |\n"
                f"| Temperature | {self.chat_manager.temperature} |\n"
                f"| Context Window | {self.chat_manager.context_window_limit} tokens |\n"
                f"| TPM Limit | {self.chat_manager.tpm_limit} |\n"
                f"| Instance Timeout | {self.chat_manager.config_manager.get('instance_timeout', 300)}s |\n"
                f"| Sandbox Mode | {'ENABLED (Wasmer)' if self.chat_manager.config_manager.get('sandbox_mode', False) else 'DISABLED (VENV)'} |\n"
                f"| Safe Mode | {'ENABLED' if self.chat_manager.config_manager.get('safemode', False) else 'DISABLED'} |"
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
                "/models_check - Verify model availability and cache results\n"
                "/fav       - Manage favorite models (/fav, /fav+, /fav -<idx>, /fav <idx>)\n"
                "/sandbox  - Toggle WebAssembly sandbox mode\n"
                "/safemode  - Toggle Safe Mode (restricts dangerous tools)\n"
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

        elif input_stripped == '/models_check':
            models = self.chat_manager.assistant.get_available_models()
            unavailable = []
            self.ui.display_info(f"Checking availability for {len(models)} models... (This may take a while)")
            
            for i, model in enumerate(models):
                # Visual progress
                if i % 10 == 0:
                    self.ui.display_info(f"Checking {i}/{len(models)}...")
                
                try:
                    # Use a timeout to avoid hanging on slow models
                    # If it times out, we assume it's available because 404s are instant
                    is_available = await asyncio.wait_for(
                        asyncio.to_thread(self.chat_manager.assistant.check_availability, model),
                        timeout=2.0
                    )
                    if not is_available:
                        unavailable.append(model)
                except asyncio.TimeoutError:
                    pass
            
            self.chat_manager.save_config("unavailable_models", unavailable)
            self.ui.display_panel("Availability Check", f"Found {len(unavailable)} unavailable models. Cache updated.", style="yellow")
            return True

        elif input_stripped.startswith('/models'):
            parts = input_stripped.split()
            models = self.chat_manager.assistant.get_available_models()
            unavailable = self.chat_manager.config_manager.get("unavailable_models", [])
            
            # 1. Determine Model
            if len(parts) == 1:
                header = "| ID | Model | ID | Model |\n|---|---|---|---|\n"
                rows = []
                for i in range(0, len(models), 2):
                    m1 = models[i]
                    if m1 in unavailable: m1 = f"~~{m1}~~"
                    
                    m2 = ""
                    idx2 = ""
                    if i+1 < len(models):
                        m2 = models[i+1]
                        if m2 in unavailable: m2 = f"~~{m2}~~"
                        idx2 = str(i+1)
                    
                    rows.append(f"| {i} | {m1} | {idx2} | {m2} |")
                self.ui.display_message(f"Available models (~~ = unavailable):\n\n{header}" + "\n".join(rows))
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

        elif input_stripped.startswith('/fav'):
            if input_stripped.startswith('/fav+'):
                parts = ['/fav', '+']
            else:
                parts = input_stripped.split()
            favorites = self.chat_manager.config_manager.get("favorites", [])
            
            if len(parts) == 1:
                # List favorites
                if not favorites:
                    self.ui.display_info("No favorite models saved. Use /fav+ to add the current one.")
                    return True
                
                header = "| ID | Model (Provider) | Temp | ID | Model (Provider) | Temp |\n|---|---|---|---|---|---|\n"
                rows = []
                for i in range(0, len(favorites), 2):
                    f1 = favorites[i]
                    m1 = f"{f1['model']} ({f1['provider']})"
                    t1 = f1['temp']
                    
                    if i + 1 < len(favorites):
                        f2 = favorites[i+1]
                        m2 = f"{f2['model']} ({f2['provider']})"
                        t2 = f2['temp']
                        rows.append(f"| {i} | {m1} | {t1} | {i+1} | {m2} | {t2} |")
                    else:
                        rows.append(f"| {i} | {m1} | {t1} | | | |")
                self.ui.display_panel("Favorite Models", header + "\n".join(rows), style="green")
                return True
            
            elif parts[1] == '+':
                # Add current to favorites
                provider = self.chat_manager.config_manager.get("provider", "Gemini")
                model = self.chat_manager.assistant._current_model
                temp = self.chat_manager.temperature
                
                new_fav = {"provider": provider, "model": model, "temp": temp}
                if new_fav not in favorites:
                    favorites.append(new_fav)
                    self.chat_manager.save_config("favorites", favorites)
                    self.ui.display_info(f"Added to favorites: {provider} | {model}")
                else:
                    self.ui.display_info("Model already in favorites.")
                return True
            
            elif parts[1].startswith('-'):
                # Remove favorite /fav -1
                try:
                    idx = int(parts[1][1:])
                    if 0 <= idx < len(favorites):
                        removed = favorites.pop(idx)
                        self.chat_manager.save_config("favorites", favorites)
                        self.ui.display_info(f"Removed from favorites: {removed['model']}")
                    else:
                        self.ui.display_error("Invalid index.")
                except (ValueError, IndexError):
                    self.ui.display_error("Usage: /fav -<index>")
                return True

            else:
                # Load favorite /fav 1
                try:
                    idx = int(parts[1])
                    if 0 <= idx < len(favorites):
                        fav = favorites[idx]
                        
                        # 1. Handle Provider
                        from src.infrastructure.gemini.adapter import GeminiAdapter
                        from src.infrastructure.nvidia.adapter import NvidiaAdapter
                        
                        providers = {"Gemini": GeminiAdapter, "NVIDIA": NvidiaAdapter}
                        provider_name = fav['provider']
                        
                        if provider_name not in providers:
                            self.ui.display_error(f"Unknown provider in favorite: {provider_name}")
                            return True
                        
                        # Only switch adapter if provider changed
                        current_provider = self.chat_manager.config_manager.get("provider")
                        if current_provider != provider_name:
                            self.chat_manager.assistant = providers[provider_name]()
                            self.chat_manager.save_config("provider", provider_name)
                        
                        # 2. Apply Model and Temp
                        model_name = fav['model']
                        temp = fav['temp']
                        
                        self.chat_manager.save_config("model_name", model_name)
                        self.chat_manager.save_config("default_temperature", temp)
                        self.chat_manager.temperature = temp
                        self.chat_manager.assistant.start_chat(model_name, self.chat_manager.system_instruction, temp)
                        
                        self.ui.display_info(f"Loaded favorite {idx}: {provider_name} | {model_name} | Temp: {temp}")
                    else:
                        self.ui.display_error("Favorite index not found.")
                except (ValueError, IndexError):
                    self.ui.display_error("Usage: /fav <index> or /fav+ or /fav -<index>")
                return True

        if input_stripped.startswith('/') or input_stripped.startswith(':'):
            self.ui.display_error("Comando no válido")
            return True

        return False
