import json
import re
import os
import datetime
import logging
import asyncio
from paser.core.logging import setup_logger

logger = setup_logger()
from paser.core.ui import console, print_panel, get_input, print_model_response, SpinnerContext
from paser.core.commands import CommandHandler
from paser.core.executor import AutonomousExecutor
from paser.core.interfaces import IAIAssistant
from prompt_toolkit.history import FileHistory
from rich.box import ROUNDED
from rich.live import Live
from rich.panel import Panel
import threading
import time
from paser.core.event_manager import EventManager, event_manager

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
    
    TIMER_TOOLS = {
        "set_timer": ("Temporizador", "󰔟"),
    }

    SYSTEM_TOOLS = {
        "is_window_in_focus": ("Verificando foco", "󰇄"),
    }

    COMPUTE_TOOLS = {
        "see_image": ("Analizando imagen", "󰍃"),
        "execute_python": ("Ejecutando Python", "󰈚"),
    }

    def __init__(self, assistant: IAIAssistant, tools: dict, system_instruction: str):
        self.assistant = assistant
        self.tools = tools
        self.system_instruction = system_instruction
        self.thinking_enabled = True
        
        self.config = self._load_config()
        self.temperature = float(self.config.get("default_temperature", 0.7))
        
        self.command_handler = CommandHandler(self)
        self.event_manager = event_manager
        self.executor = AutonomousExecutor(
            self.assistant,
            self.tools,
            on_tool_used=self._on_tool_used,
            on_tool_start=self._on_tool_start,
        )
        
        # Lazy loading synchronization
        self._initialized_event = threading.Event()
        self._init_error = None

    def _load_config(self):
        try:
            # chat_manager.py está en paser/core/, subimos dos niveles para llegar a la raíz
            config_path = os.path.join(os.path.dirname(__file__), '..', 'config', 'config.json')
            with open(config_path, "r") as f:
                return json.load(f)
        except Exception:
            return {}

    def _on_tool_start(self, tool_name: str, args: dict):
        """Callback ejecutado por el executor justo antes de iniciar una herramienta."""
        if tool_name in self.COMPUTE_TOOLS:
            verb, icon = self.COMPUTE_TOOLS[tool_name]
            if tool_name == "see_image":
                path = args.get("path", "desconocido")
                filename = os.path.basename(path)
                return SpinnerContext(f"{icon} {verb} {filename}...", color="yellow")
            return SpinnerContext(f"{icon} {verb}...", color="yellow")
        return None

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
            console.print(f"  {icon} {verb} {status_icon}", style="dim yellow")
        
        elif tool_name in self.TIMER_TOOLS:
            verb, icon = self.TIMER_TOOLS[tool_name]
            status_icon = "󰄵" if success else "󰅚"
            # Extraemos info para feedback
            if "with message:" in result:
                msg_part = result.split("with message:")[1].strip()
            else:
                msg_part = args.get("message", "Timer")
            
            console.print(f"  {icon} Programado: {msg_part} ({args.get('seconds', '?')}s) {status_icon}", style="dim yellow")
        
        elif tool_name in self.SYSTEM_TOOLS:
            verb, icon = self.SYSTEM_TOOLS[tool_name]
            status_icon = "󰄵" if success else "󰅚"
            console.print(f"  {icon} {verb} {status_icon}", style="dim yellow")
    
    async def _event_monitor_loop(self):
        """Hilo de fondo que revisa eventos expirados e inyecta mensajes al agente."""
        while True:
            try:
                # DEBUG: Imprimir hora actual y eventos
                # print(f"DEBUG: Checking events... {time.time()}")
                expired_events = self.event_manager.check_expired_events()
                for msg in expired_events:
                    # Usamos una representación segura del mensaje para evitar UnicodeEncodeError
                    safe_msg = msg.encode('ascii', 'replace').decode('ascii')
                    sys_msg = f"[SISTEMA: El temporizador '{safe_msg}' ha expirado. Por favor, reacciona]."
                    console.print(f"\n[EVENTO] {safe_msg}", style="bold magenta")
                    with SpinnerContext("Procesando evento", "magenta"):
                        res = await self.executor.execute(
                            user_input=sys_msg,
                            thinking_enabled=self.thinking_enabled,
                            get_confirmation_callback=get_input
                        )
                    if res:
                        # Limpieza de etiquetas de herramientas
                        cleaned = re.sub(r'<(?:TOOL_CALL|TOOL_RESPONSE)>.*?</(?:TOOL_CALL|TOOL_RESPONSE)>', '', res, flags=re.DOTALL)
                        if cleaned.strip(): print_model_response(cleaned)
                await asyncio.sleep(1)
            except Exception as e:
                # Logging más detallado
                import traceback
                logger.error("Event loop error", extra={"error": str(e)})
                traceback.print_exc()
                await asyncio.sleep(10)

    async def run(self):
        # Iniciar inicialización en segundo plano (Lazy Loading)
        asyncio.create_task(asyncio.to_thread(self._initialize_chat))
        
        # Iniciar monitoreo de eventos como tarea de asyncio
        asyncio.create_task(self._event_monitor_loop())
        
        # La sincronización ahora ocurre dentro del loop para permitir el prompt inmediato

        initialized_notified = False


        history = FileHistory(".chat_history")
        
        while True:
            try:
                user_input = await get_input("│  ", history=history)
            except (EOFError, KeyboardInterrupt):
                break
                
            if not user_input:
                if not initialized_notified and self._initialized_event.is_set():
                    console.print(f"\n[bold green]\u2713[/bold green] Modelo cargado: [cyan]{self.assistant.current_model}[/cyan] | Temp: {self.temperature:.1f}", style="dim")
                    initialized_notified = True
                continue

            # Sincronización: Esperar a que la API esté lista antes de procesar cualquier input
            if not self._initialized_event.is_set():
                with SpinnerContext("Conectando con la API...", "cyan"):
                    while not self._initialized_event.is_set() and self._init_error is None:
                        await asyncio.sleep(0.1)
            
            if self._init_error:
                console.print(f"\n[bold red]\u26a0 Error de inicialización:[/bold red] {self._init_error}", style="red")
                print_panel("Error de Conexión", "No se pudo conectar con la API de Gemini. Por favor, verifica tu internet y reinicia la aplicación.", style="red")
                break

            if not initialized_notified:
                console.print(f"\n[bold green]\u2713[/bold green] Modelo cargado: [cyan]{self.assistant.current_model}[/cyan] | Temp: {self.temperature:.1f}", style="dim")
                initialized_notified = True

            # Interceptar eventos de sistema (JSON)
            try:
                event_data = json.loads(user_input)
                if isinstance(event_data, dict) and event_data.get("type") == "timer_event":
                    msg = event_data.get("message", "Timer timeout")
                    # Renderizado especial con icono de reloj (Nerd Font)
                    console.print(f"\n\udb80\udec3 [SISTEMA] {msg}", style="bold magenta")
                    # Convertimos el JSON en una instrucción clara para el modelo
                    user_input = f"[SISTEMA: El temporizador '{msg}' ha expirado. Por favor, reacciona]."
            except json.JSONDecodeError:
                pass

            if user_input.strip() == ':q': 

                break
            
            # El input ya se mostró por prompt_toolkit con su estilo
            
            # Intentar procesar como comando
            if await self.command_handler.handle(user_input):
                continue
            
            # Ejecución autónoma con spinner
            execution_task = None
            try:
                with SpinnerContext("", "cyan"):
                    execution_task = asyncio.create_task(
                        self.executor.execute(
                            user_input=user_input,
                            thinking_enabled=self.thinking_enabled,
                            get_confirmation_callback=get_input
                        )
                    )
                    result = await execution_task
            except (KeyboardInterrupt, asyncio.CancelledError):
                self.executor.stop_requested = True
                console.print("\n[bold red]⚠ Interrumpiendo ejecución...[/bold red] Esperando a que termine la tarea actual.", style="red")
                if execution_task:
                    try:
                        await execution_task
                    except Exception:
                        pass
                result = "Ejecución interrumpida por el usuario."
            except Exception as e:
                result = f"Error durante la ejecución: {str(e)}"
            
            # Mostrar respuesta del modelo (filtrando bloques internos)
            if result:
                cleaned = re.sub(r'<TOOL_CALL>.*?</TOOL_CALL>', '', result, flags=re.DOTALL)
                cleaned = re.sub(r'<TOOL_RESPONSE>.*?</TOOL_RESPONSE>', '', cleaned, flags=re.DOTALL)
                if cleaned.strip():
                    print_model_response(cleaned)
    
    def _initialize_chat(self):
        try:
            model = str(self.config.get("model_name", "models/gemma-2-27B-it"))
            self.assistant.start_chat(model, self.system_instruction, self.temperature)
            self._initialized_event.set()
        except Exception as e:
            self._init_error = e
            logger.info("Background initialization failed", extra={"error": str(e)})
    
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
            
        self.temperature = float(session_data["temperature"])
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
