from paser.core.ui import console

class CommandHandler:
    def __init__(self, chat_manager):
        self.chat_manager = chat_manager
        self.history = []

    def log_tool(self, name, status):
        self.history.append({"name": name, "status": status})

    async def handle(self, user_input):
        input_stripped = user_input.strip()
        
        # 🚪 Salida
        if input_stripped.lower() in (':q', '/q', '/quit', '/exit'):
            self.chat_manager.should_exit = True
            return True

        # ⚙️ Configuración del Agente
        elif input_stripped == '/models':
            models = self.chat_manager.assistant.get_available_models()
            for i, m in enumerate(models): console.print(f"{i}: {m}")
            
            # Usamos la interfaz de UI del chat_manager para pedir input
            choice = await self.chat_manager.ui.request_input("Modelo: ")
            try:
                idx = int(choice)
                model_name = models[idx]
                temp_input = await self.chat_manager.ui.request_input(f"Temp (0-1, default {self.chat_manager.temperature}): ")
                new_temp = float(temp_input or self.chat_manager.temperature)
                
                # Persistir en config
                config_path = os.path.join(os.path.dirname(__file__), '..', 'config', 'config.json')
                import os, json
                try:
                    with open(config_path, "r") as f: config = json.load(f)
                except Exception: config = {}
                config["model_name"] = model_name
                config["default_temperature"] = new_temp
                with open(config_path, "w") as f: json.dump(config, f, indent=4)
                
                self.chat_manager.temperature = new_temp
                self.chat_manager.assistant.start_chat(model_name, self.chat_manager.system_instruction, new_temp)
                
                from paser.core.ui import print_panel
                print_panel("Modelo cambiado", f"\udb80\udd35 {model_name} | Temperatura: {new_temp}", style="green")
            except Exception as e: console.print(f"Error: {e}", style="red")
            return True

        if input_stripped.startswith('/') or input_stripped.startswith(':'):
            console.print("Comando no válido", style="red")
            return True

        return False
