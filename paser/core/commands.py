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

        elif input_stripped == '/help':
            help_text = (
                "Available Commands:\n"
                "-------------------\n"
                "/help    - Show this help menu\n"
                "/models  - Change AI model and temperature\n"
                "/s       - Save a snapshot of the last interaction\n"
                "/t       - Display current context window token count\n"
                "/q, /quit, /exit - Exit the application"
            )
            self.ui.display_message(help_text)
            return True

        # Configuración del Agente
        elif input_stripped == '/models':
            models = self.chat_manager.assistant.get_available_models()
            model_list = "\n".join([f"{i}: {m}" for i, m in enumerate(models)])
            self.ui.display_message(f"Available models:\n{model_list}")
            
            choice = await self.ui.request_input("Modelo: ")
            try:
                idx = int(choice)
                model_name = models[idx]
                temp_input = await self.ui.request_input(f"Temp (0-1, default {self.chat_manager.temperature}): ")
                new_temp = float(temp_input or self.chat_manager.temperature)
                
                # Persistir en config
                self.chat_manager.save_config("model_name", model_name)
                self.chat_manager.save_config("default_temperature", new_temp)
                
                self.chat_manager.temperature = new_temp
                self.chat_manager.assistant.start_chat(model_name, self.chat_manager.system_instruction, new_temp)
                
                self.ui.display_info(f"Modelo cambiado a {model_name} | Temperatura: {new_temp}")
            except Exception as e: 
                self.ui.display_error(f"Error: {e}")
            return True

        if input_stripped.startswith('/') or input_stripped.startswith(':'):
            self.ui.display_error("Comando no válido")
            return True

        return False
