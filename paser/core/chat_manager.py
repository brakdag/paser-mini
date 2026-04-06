import json
import re
import os
import datetime
from paser.core.interfaces import IAIAssistant
from paser.core.ui import console, print_panel, get_input, print_model_response, SpinnerContext
from paser.core.commands import CommandHandler
from paser.core.executor import AutonomousExecutor
from prompt_toolkit.history import FileHistory
from rich.box import ROUNDED

class ChatManager:
    # Herramientas que producen feedback de archivo
    # Usando glifos de Meslo Nerd Font
    FILE_TOOLS = {
        "read_file": ("Leyó", "󰈚"),
        "read_files": ("Leyó", "󰈚"),
        "write_file": ("Escribió", "󰈚"),
        "remove_file": ("Borró", "󰆵"),
        "update_line": ("Modificó", "󰈚"),
        "replace_text": ("Reemplazó", "󰑐"),
        "replace_block": ("Reemplazó (bloque)", "󰑐"),
        "read_head": ("Leyó (cabecera)", "󰈚"),
        "read_lines": ("Leyó (rango)", "󰈚"),
        "rename_path": ("Movió", "󰑐"),
        "make_dir": ("Creó", "󰉋"),
        "glob_search": ("Buscó archivos", "󰍃"),
        "global_search": ("Buscó texto", "󰍃"),
    }

    NOTIFICATION_TOOLS = {
        "notify_user": ("Notificación", "󰋃"),
    }

    SYSTEM_TOOLS = {
        "is_window_in_focus": ("Verificando foco", "󰇄"),
    }

    def __init__(self, assistant: IAIAssistant, tools: dict, system_instruction: str):
        self.assistant = assistant
        self.tools = tools
        self.system_instruction = system_instruction
        self.thinking_enabled = True
        
        self.config = self._load_config()
        self.temperature = self.config.get("default_temperature", 0.7)
        
        self.command_handler = CommandHandler(self)
        self.executor = AutonomousExecutor(
            self.assistant,
            self.tools,
            on_tool_used=self._on_tool_used,
        )

    def _load_config(self):
        try:
            # chat_manager.py está en paser/core/, subimos dos niveles para llegar a la raíz
            config_path = os.path.join(os.path.dirname(__file__), '..', 'config', 'config.json')
            with open(config_path, "r") as f:
                return json.load(f)
        except Exception:
            return {}

    def _on_tool_used(self, tool_name: str, args: dict, result: str, success: bool):
        """Callback ejecutado por el executor cuando se usa una herramienta."""
        if tool_name in self.FILE_TOOLS:
            verb, icon = self.FILE_TOOLS[tool_name]
            status_icon = "󰄵" if success else "󰅚"
            
            # Personalización de mensaje según herramienta
            if tool_name == "rename_path":
                origen = os.path.basename(args.get("origen", "desconocido"))
                destino = os.path.basename(args.get("destino", "desconocido"))
                msg = f"{origen} -> {destino}"
            elif tool_name == "make_dir":
                msg = args.get("path", "desconocido")
            elif tool_name == "read_files":
                paths = args.get("paths", [])
                msg = f"{len(paths)} archivos" if paths else "sin archivos"
            elif tool_name == "glob_search":
                msg = args.get("pattern", "patrón desconocido")
            elif tool_name == "global_search":
                msg = args.get("query", "consulta desconocida")
            else:
                path = args.get("path", "archivo desconocido")
                msg = os.path.basename(path) if path else "archivo desconocido"
                
            console.print(f"  {icon} {verb}: {msg} {status_icon}", style="dim yellow")
        
        elif tool_name in self.NOTIFICATION_TOOLS:
            verb, icon = self.NOTIFICATION_TOOLS[tool_name]
            status_icon = "󰄵" if success else "󰅚"
            mensaje = args.get("mensaje", "")
            console.print(f"  {icon} {verb}: {mensaje} {status_icon}", style="dim yellow")
        
        elif tool_name in self.SYSTEM_TOOLS:
            verb, icon = self.SYSTEM_TOOLS[tool_name]
            status_icon = "󰄵" if success else "󰅚"
            console.print(f"  {icon} {verb} {status_icon}", style="dim yellow")
    
    def run(self):
        self._initialize_chat()
        
        # Welcome panel
        model_name = self.assistant.current_model or "Desconocido"
        temp_str = f"{self.temperature:.1f}"
        print_panel(
            "󰛩 Passer",
            f"Modelo: {model_name}  |  Temperatura: {temp_str}",
            box_type=ROUNDED,
            style="cyan",
        )
        
        history = FileHistory(".chat_history")
        
        while True:
            try:
                user_input = get_input("<ansigreen>│</ansigreen>  ", history=history)
            except (EOFError, KeyboardInterrupt):
                break
                
            if not user_input: 
                continue
            if user_input.strip() == ':q': 
                print_panel("Adiós", "¡Hasta la próxima! ", style="green")
                break
            
            # El input ya se mostró por prompt_toolkit con su estilo
            
            # Intentar procesar como comando
            if self.command_handler.handle(user_input):
                continue
            
            # Ejecución autónoma con spinner
            with SpinnerContext("", "cyan"):
                result = self.executor.execute(
                    user_input=user_input,
                    thinking_enabled=self.thinking_enabled,
                    get_confirmation_callback=get_input
                )
            
            # Mostrar respuesta del modelo (filtrando bloques internos)
            if result:
                cleaned = re.sub(r'<TOOL_CALL>.*?</TOOL_CALL>', '', result, flags=re.DOTALL)
                cleaned = re.sub(r'<TOOL_RESPONSE>.*?</TOOL_RESPONSE>', '', cleaned, flags=re.DOTALL)
                if cleaned.strip():
                    print_model_response(cleaned)
    
    def _initialize_chat(self):
        model = self.config.get("model_name", "models/gemma-2-27B-it")
        self.assistant.start_chat(model, self.system_instruction, self.temperature)
    
    def save_session(self, name: str = None):
        if not name:
            name = self.get_session_title()
        
        session_dir = os.path.join(os.path.dirname(__file__), '..', '..', 'sessions')
        os.makedirs(session_dir, exist_ok=True)
        
        session_data = {
            "model_name": self.assistant.current_model,
            "temperature": self.temperature,
            "history": self.assistant.get_history()
        }
        
        path = os.path.join(session_dir, f"{name}.json")
        with open(path, "w") as f:
            json.dump(session_data, f, indent=4)
        return path

    def load_session(self, name: str):
        session_dir = os.path.join(os.path.dirname(__file__), '..', '..', 'sessions')
        path = os.path.join(session_dir, f"{name}.json")
        
        with open(path, "r") as f:
            session_data = json.load(f)
            
        self.temperature = session_data["temperature"]
        self.assistant.load_history(
            session_data["history"],
            session_data["model_name"],
            self.temperature
        )

    def get_session_title(self):
        try:
            # Ask AI for a short 3-word title
            response = self.assistant.send_message("Please provide a very short, 3-word title for this conversation session. Return only the title text, nothing else.")
            # Response might be a complex object, need to extract text
            # Assuming it's an object with a .text attribute or similar
            title = str(response.text if hasattr(response, 'text') else response).strip()
            return re.sub(r'[^a-zA-Z0-9]', '_', title)
        except Exception:
            return datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
