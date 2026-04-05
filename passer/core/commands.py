import json
from rich.table import Table
from passer.core.ui import get_input, console, print_panel
import passer.tools.file_tools as tf
import passer.tools.tools_functions as tfunc

class CommandHandler:
    def __init__(self, chat_manager):
        self.chat_manager = chat_manager
        self.history = []

    def log_tool(self, name, status):
        self.history.append({"name": name, "status": status})

    def handle(self, user_input):
        input_stripped = user_input.strip()
        
        if input_stripped.startswith('/cd '):
            path = input_stripped[4:]
            try:
                tf.set_project_root(path)
                tfunc.set_project_root(path) # Asegurar sincronización
                console.print(f"Directorio cambiado a: {tf.PROJECT_ROOT}", style="green")
            except FileNotFoundError as e:
                console.print(str(e), style="red")
            return True

        elif input_stripped == '/history':
            table = Table(title="Historial de Herramientas")
            table.add_column("Herramienta", style="cyan")
            table.add_column("Status", style="green")
            for entry in self.history:
                table.add_row(entry["name"], entry["status"])
            console.print(table)
            return True

        elif input_stripped in ('/clear', '/cls'):
            console.clear()
            return True
            
        elif input_stripped == '/thinking':
            self.chat_manager.thinking_enabled = not self.chat_manager.thinking_enabled
            console.print(f"Pensamientos: {'Visible' if self.chat_manager.thinking_enabled else 'Oculto'}", style="bold")
            return True
            
        elif input_stripped == '/models':
            models = self.chat_manager.assistant.get_available_models()
            for i, m in enumerate(models): 
                console.print(f"{i}: {m}")
            
            choice = get_input("Modelo: ")
            try:
                idx = int(choice)
                model_name = models[idx]
                temp_input = get_input(f"Temp (0-1, default {self.chat_manager.temperature}): ")
                new_temp = float(temp_input or self.chat_manager.temperature)
                
                config_path = "config.json"
                try:
                    with open(config_path, "r") as f:
                        config = json.load(f)
                except Exception:
                    config = {}
                config["model_name"] = model_name
                config["default_temperature"] = new_temp
                with open(config_path, "w") as f:
                    json.dump(config, f, indent=4)
                
                self.chat_manager.temperature = new_temp
                self.chat_manager.assistant.start_chat(
                    model_name, 
                    self.chat_manager.system_instruction, 
                    new_temp
                )
                print_panel("Modelo cambiado", f"✅ {model_name} | Temperatura: {new_temp}", style="green")
            except Exception as e:
                console.print(f"Error: {e}", style="red")
            return True
            
        return False
