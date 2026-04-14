import os
import json

class CommandHandler:
    def __init__(self, chat_manager):
        self.chat_manager = chat_manager
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
                print(f"\n[SAVE] Last interaction saved to save_langchain/")
            else:
                print(f"\n[SAVE] No interaction found to save.")
            return True

        # Configuración del Agente
        elif input_stripped == '/models':
            models = self.chat_manager.assistant.get_available_models()
            for i, m in enumerate(models): 
                print(f"{i}: {m}")
            
            choice = await self.chat_manager.ui.request_input("Modelo: ")
            try:
                idx = int(choice)
                model_name = models[idx]
                temp_input = await self.chat_manager.ui.request_input(f"Temp (0-1, default {self.chat_manager.temperature}): ")
                new_temp = float(temp_input or self.chat_manager.temperature)
                
                # Persistir en config
                self.chat_manager.save_config("model_name", model_name)
                self.chat_manager.save_config("default_temperature", new_temp)
                
                self.chat_manager.temperature = new_temp
                self.chat_manager.assistant.start_chat(model_name, self.chat_manager.system_instruction, new_temp)
                
                print(f"\n[CONFIG] Modelo cambiado a {model_name} | Temperatura: {new_temp}")
            except Exception as e: 
                print(f"Error: {e}")
            return True

        if input_stripped.startswith('/') or input_stripped.startswith(':'):
            print("Comando no válido")
            return True

        return False
