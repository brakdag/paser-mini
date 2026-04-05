import json
import re
import os
from passer.core.interfaces import IAIAssistant
from passer.core.ui import console, print_panel, get_input, print_model_response, SpinnerContext
from passer.core.commands import CommandHandler
from passer.core.executor import AutonomousExecutor
from prompt_toolkit.history import FileHistory
from rich.box import ROUNDED

class ChatManager:
    # Herramientas que producen feedback de archivo
    FILE_TOOLS = {
        "leer_archivo": ("Leyó", "📖"),
        "escribir_archivo": ("Escribió", "📝"),
        "borrar_archivo": ("Borró", "🗑️"),
        "modificar_linea": ("Modificó", "📝"),
        "reemplazar_texto": ("Reemplazó", "🔄"),
        "reemplazar_bloque_texto": ("Reemplazó (bloque)", "🔄"),
        "leer_cabecera": ("Leyó (cabecera)", "📖"),
        "leer_lineas": ("Leyó (rango)", "📖"),
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
            with open("config.json", "r") as f:
                return json.load(f)
        except Exception:
            return {}

    def _on_tool_used(self, tool_name: str, args: dict, result: str, success: bool):
        """Callback ejecutado por el executor cuando se usa una herramienta."""
        if tool_name in self.FILE_TOOLS:
            verb, icon = self.FILE_TOOLS[tool_name]
            # Extraer nombre de archivo del argumento 'path' si existe
            path = args.get("path", "archivo desconocido")
            filename = os.path.basename(path) if path else "archivo desconocido"
            status_icon = "✅" if success else "❌"
            console.print(f"  {icon} {verb}: {filename} {status_icon}", style="dim yellow")
    
    def run(self):
        self._initialize_chat()
        
        # Welcome panel
        model_name = self.assistant.current_model or "Desconocido"
        temp_str = f"{self.temperature:.1f}"
        print_panel(
            "🐶 Passer",
            f"Modelo: {model_name}  |  Temperatura: {temp_str}",
            box_type=ROUNDED,
            style="cyan",
        )
        
        history = FileHistory(".chat_history")
        
        while True:
            try:
                user_input = get_input("❯ ", history=history)
            except (EOFError, KeyboardInterrupt):
                break
                
            if not user_input: 
                continue
            if user_input.strip() == ':q': 
                print_panel("Adiós", "¡Hasta la próxima! 👋", style="green")
                break
            
            # El input ya se mostró por prompt_toolkit con su estilo
            
            # Intentar procesar como comando
            if self.command_handler.handle(user_input):
                continue
            
            # Ejecución autónoma con spinner
            with SpinnerContext("Pensando", "cyan"):
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
        model = self.config.get("model_name", "models/gemma-4-31b-it")
        self.assistant.start_chat(model, self.system_instruction, self.temperature)
