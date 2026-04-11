import json
import os
from rich.table import Table
from paser.core.ui import get_input, console, print_panel, LATEX_TO_UNICODE
from paser.tools import core_tools

class CommandHandler:
    def __init__(self, chat_manager):
        self.chat_manager = chat_manager
        self.history = []

    def log_tool(self, name, status):
        self.history.append({"name": name, "status": status})

    async def handle(self, user_input):
        input_stripped = user_input.strip()
        
        if input_stripped.lower() in (':q', '/q', '/quit', '/exit'):
            self.chat_manager.should_exit = True
            return True

        if input_stripped.startswith('/cd '):
            path = input_stripped[4:]
            try:
                core_tools.context.set_root(path)
                console.print(f"Directorio cambiado a: {core_tools.context.root}", style="green")
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

        elif input_stripped == '/latex':
            table = Table(title="Símbolos LaTeX Soportados", show_lines=True)
            table.add_column("LaTeX", style="cyan")
            table.add_column("Unicode", style="green")
            for latex, unicode_char in sorted(LATEX_TO_UNICODE.items()):
                table.add_row(latex, unicode_char)
            console.print(table)
            return True

        elif input_stripped in ('/clear', '/cls'):
            console.clear()
            return True
            
        elif input_stripped == '/session':
            session_dir = os.path.join(os.path.dirname(__file__), '..', '..', 'sessions')
            os.makedirs(session_dir, exist_ok=True)
            sessions = [f for f in os.listdir(session_dir) if f.endswith('.json')]
            if not sessions:
                console.print("No hay sesiones guardadas.", style="yellow")
                return True
            for i, s in enumerate(sessions): console.print(f"{i}: {s}")
            choice = await get_input("Selecciona sesión (o 'c' para cancelar): ")
            if choice == 'c': return True
            try:
                idx = int(choice)
                name = sessions[idx].replace('.json', '')
                self.chat_manager.load_session(name)
                print_panel("Sesión cargada", f"󰄵 {name}", style="green")
            except Exception as e: console.print(f"Error cargando sesión: {e}", style="red")
            return True
            
        elif input_stripped == '/thinking':
            self.chat_manager.thinking_enabled = not self.chat_manager.thinking_enabled
            console.print(f"Pensamientos: {'Visible' if self.chat_manager.thinking_enabled else 'Oculto'}", style="bold")
            return True
            
        elif input_stripped == '/new':
            path = self.chat_manager.save_session("last_session")
            self.chat_manager.assistant.start_chat(self.chat_manager.assistant.current_model, self.chat_manager.system_instruction, self.chat_manager.temperature)
            self.chat_manager.executor.turn_count = 0
            self.history = []
            print_panel("Sesión Reiniciada", f"Historial limpiado y sesión guardada en {path}", style="green")
            return True
            
        elif input_stripped == '/models':
            models = self.chat_manager.assistant.get_available_models()
            for i, m in enumerate(models): console.print(f"{i}: {m}")
            choice = await get_input("Modelo: ")
            try:
                idx = int(choice)
                model_name = models[idx]
                temp_input = await get_input(f"Temp (0-1, default {self.chat_manager.temperature}): ")
                new_temp = float(temp_input or self.chat_manager.temperature)
                config_path = os.path.join(os.path.dirname(__file__), '..', 'config', 'config.json')
                try:
                    with open(config_path, "r") as f: config = json.load(f)
                except Exception: config = {}
                config["model_name"] = model_name
                config["default_temperature"] = new_temp
                with open(config_path, "w") as f: json.dump(config, f, indent=4)
                self.chat_manager.temperature = new_temp
                self.chat_manager.assistant.start_chat(model_name, self.chat_manager.system_instruction, new_temp)
                print_panel("Modelo cambiado", f"󰄵 {model_name} | Temperatura: {new_temp}", style="green")
            except Exception as e: console.print(f"Error: {e}", style="red")
            return True

        elif input_stripped.startswith('/max_turns'):
            parts = input_stripped.split()
            if len(parts) < 2: console.print("Uso: /max_turns [número]", style="red")
            else:
                try:
                    new_max = int(parts[1])
                    if new_max <= 0: raise ValueError
                    self.chat_manager.executor.max_turns = new_max
                    console.print(f"Límite de turnos actualizado a: {new_max}", style="green")
                except ValueError: console.print("Por favor, proporciona un número entero positivo.", style="red")
            return True

        elif input_stripped.startswith('/repeat '):
            parts = input_stripped.split(maxsplit=2)
            if len(parts) < 3: console.print("Uso: /repeat [minutos] [mensaje]", style="red")
            else:
                try:
                    self.chat_manager.recurring_tasks[int(parts[1])] = {"msg": parts[2], "last_run": time.time()}
                    console.print(f"Gallina configurada: '{parts[2]}' cada {parts[1]} minutos.", style="green")
                except ValueError: console.print("El tiempo debe ser un número entero.", style="red")
            return True

        elif input_stripped == '/stop_repeat':
            self.chat_manager.recurring_tasks = {}
            console.print("Gallina detenida. Ya no picoteará más.", style="yellow")
            return True

        elif input_stripped == '/t':
            try:
                history = self.chat_manager.assistant.get_chat_history()
                if history: console.print(f"[bold cyan]󰋃 Contexto actual:[/bold cyan] {self.chat_manager.assistant.count_tokens(history)} tokens", style="yellow")
                else: console.print("No hay una sesión de chat activa.", style="red")
            except Exception as e: console.print(f"Error estimando tokens: {e}", style="red")
            return True
        
        elif input_stripped.startswith('/close_issue'):
            parts = input_stripped.split()
            if len(parts) < 3: console.print("Uso: /close_issue [repo] [issue_number]", style="red")
            else:
                try:
                    from paser.tools.github_tools import close_issue
                    console.print(close_issue(parts[1], int(parts[2])), style="green")
                except Exception as e: console.print(f"Error: {e}", style="red")
            return True
            
        return False