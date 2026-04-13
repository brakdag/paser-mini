import json
import os
import re
import subprocess
from datetime import datetime
from rich.table import Table
from paser.core.ui import get_input, console, print_panel, LATEX_TO_UNICODE, SpinnerContext, print_model_response
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
            # 1. Generar resumen de la sesión actual
            summary_prompt = "Por favor, genera un resumen conciso de nuestra conversación hasta ahora en aproximadamente 200 palabras."
            with SpinnerContext("Generando resumen de la sesión...", "magenta", newline=True):
                try:
                    response = self.chat_manager.assistant.send_message(summary_prompt)
                    summary_text = response.text if hasattr(response, 'text') else str(response)
                except Exception as e:
                    summary_text = f"No se pudo generar el resumen: {e}"
            
            print_panel("Resumen de la Sesión", summary_text, style="cyan")
            
            # 2. Guardar y Reiniciar
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

        elif input_stripped == '/quota':
            try:
                model = self.chat_manager.executor.assistant.current_model
                count = self.chat_manager.executor.quota_tracker.get_current_count(model)
                limit = self.chat_manager.executor.quota_tracker.get_limit(model)
                
                if limit > 0:
                    usage_str = f"{count} / {limit}"
                    percent = (count / limit) * 100
                    status = f" ({percent:.1f}%)"
                else:
                    usage_str = f"{count} (sin límite conocido)"
                    status = ""
                
                console.print(f"[bold cyan]󰋃 Consumo de API hoy ({model}):[/bold cyan] {usage_str}{status}", style="yellow")
            except Exception as e: console.print(f"Error consultando cuota: {e}", style="red")
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

        elif input_stripped == '/save_langchain':
            # Toggle the state
            current_state = getattr(self.chat_manager.assistant, 'save_langchain_enabled', False)
            new_state = not current_state
            
            # Update assistant
            if hasattr(self.chat_manager.assistant, 'save_langchain_enabled'):
                self.chat_manager.assistant.save_langchain_enabled = new_state
            
            # Update ChatManager state and persist to config
            self.chat_manager.save_langchain_enabled = new_state
            self.chat_manager.config_manager.set("save_langchain_enabled", new_state)
            
            status = "Activado" if new_state else "Desactivado"
            console.print(f"Guardado de LangChain: {status}", style="green")
            return True

        elif input_stripped == '/snapshot':
            try:
                # 1. Preparar ruta y nombre
                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                filename = f"snapshot_{timestamp}.png"
                assets_dir = "assets"
                os.makedirs(assets_dir, exist_ok=True)
                filepath = os.path.join(assets_dir, filename)

                # 2. Intentar capturar pantalla (scrot -> maim)
                captured = False
                for tool in ['scrot', 'maim']:
                    try:
                        # scrot usa -o para el output, maim usa el path directamente
                        cmd = [tool, '-o', filepath] if tool == 'scrot' else [tool, filepath]
                        subprocess.run(cmd, check=True, capture_output=True)
                        captured = True
                        break
                    except (subprocess.CalledProcessError, FileNotFoundError):
                        continue
                
                if not captured:
                    console.print("[bold red]Error:[/bold red] No se encontró 'scrot' ni 'maim' instalados en el sistema.", style="red")
                    console.print("Instálalos con: [bold]sudo apt install scrot maim[/bold]", style="dim")
                    return True

                print_panel("Captura realizada", f"Archivo guardado en: {filepath}", style="green")

                # 3. Notificar a la IA para análisis inmediato
                notification = f"He realizado una captura de pantalla del sistema: {filepath}. Por favor, analízala y dime qué ves."
                
                with SpinnerContext("Analizando captura...", "magenta", newline=True):
                    # Llamamos al executor directamente para que la IA procese la imagen
                    result = await self.chat_manager.executor.execute(
                        user_input=notification, 
                        thinking_enabled=self.chat_manager.thinking_enabled, 
                        get_confirmation_callback=get_input
                    )
                    if result:
                        print_model_response(re.sub(r'<[^>]+>.*?</[^>]+>', '', result, flags=re.DOTALL))
                
                return True
            except Exception as e:
                console.print(f"[bold red]Error crítico en /snapshot:[/bold red] {e}", style="red")
                return True

        if input_stripped.startswith('/') or input_stripped.startswith(':'):
            console.print("Comando no válido", style="red")
            return True

        return False
