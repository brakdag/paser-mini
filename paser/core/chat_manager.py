import json
import re
import os
import asyncio
import threading
from typing import Any, Optional

from paser.core.logging import setup_logger
from paser.core.ui_interface import UserInterface
from paser.core.commands import CommandHandler
from paser.core.executor import AutonomousExecutor
from paser.core.event_manager import event_manager
from paser.core.tool_registry import get_tool_metadata
from paser.core.config_manager import ConfigManager
from paser.core.event_monitor import EventMonitor
from prompt_toolkit.history import FileHistory

logger = setup_logger()

class ChatManager:
    def __init__(self, assistant, tools, system_instruction, ui: UserInterface):
        self.assistant = assistant
        self.tools = tools
        self.system_instruction = system_instruction
        self.ui = ui
        
        config_path = os.path.join(os.path.dirname(__file__), '..', 'config', 'config.json')
        self.config_manager = ConfigManager(config_path)
        
        self.thinking_enabled = self.config_manager.get("thinking_enabled", True)
        self.temperature = float(self.config_manager.get("default_temperature", 0.7))
        
        # Langchain saving toggle
        self.save_langchain_enabled = self.config_manager.get("save_langchain_enabled", False)
        if hasattr(self.assistant, 'save_langchain_enabled'):
            self.assistant.save_langchain_enabled = self.save_langchain_enabled
        
        self.command_handler = CommandHandler(self)
        self.executor = AutonomousExecutor(
            self.assistant, self.tools,
            on_tool_used=self._on_tool_used,
            on_tool_start=self._on_tool_start,
            on_thought=self._on_thought
        )
        self.event_monitor = EventMonitor(event_manager, self.executor)
        self.should_exit = False
        
        self._initialized_event = threading.Event()
        self._init_error = None

    def _on_thought(self, thought_text):
        if not self.thinking_enabled: return
        self.ui.display_thought(thought_text)

    def _get_tool_detail(self, tool_name, args):
        """Extracts a highly representative human-readable detail from tool arguments."""
        if not args:
            return ""
        
        if tool_name == 'rename_path':
            orig = os.path.basename(args.get('origen', 'unknown'))
            dest = os.path.basename(args.get('destino', 'unknown'))
            return f": {orig} \u2192 {dest}"
        
        if tool_name == 'create_issue':
            return f": {args.get('repo', 'repo')} / {args.get('title', 'issue')[:20]}..."

        path_keys = ['path', 'filepath', 'origen', 'destino', 'input_path']
        for pk in path_keys:
            if pk in args and isinstance(args[pk], str):
                return f": {os.path.basename(args[pk])}"

        priority_keys = ['query', 'url', 'symbol', 'repo', 'mensaje', 'issue_number']
        for key in priority_keys:
            if key in args:
                val = str(args[key])
                if len(val) > 40:
                    val = val[:37] + "..."
                return f": {val}"
        
        try:
            first_val = str(next(iter(args.values())))
            if len(first_val) > 40:
                first_val = first_val[:37] + "..."
            return f": {first_val}"
        except StopIteration:
            return ""

    def _on_tool_start(self, tool_name, args):
        detail = self._get_tool_detail(tool_name, args)
        # We use the UI's spinner context manager
        return self.ui.get_spinner(f"{tool_name}{detail}...", color="", newline=True)

    def _on_tool_used(self, tool_name, args, result, success):
        detail = self._get_tool_detail(tool_name, args)
        
        if tool_name == 'create_issue' and success and isinstance(result, str):
            import re
            match = re.search(r'#(\d+)', result)
            if match:
                detail = f": #{match.group(1)}"

        self.ui.display_tool_status(tool_name, success, detail)

    async def run(self):
        loop = asyncio.get_running_loop()
        asyncio.create_task(asyncio.to_thread(self._initialize_chat))
        asyncio.create_task(self.event_monitor.monitor_loop(self.thinking_enabled))
        
        from paser.core.audio_manager import AudioManager
        self.audio_manager = AudioManager()
        self.is_recording = False
        
        def toggle_audio():
            if not self.is_recording:
                self.is_recording = True
                self.ui.set_ui_mode("AUDIO")
                try:
                    self.audio_manager.start_recording()
                    self.ui.display_message("\n[bold red]🎤 Recording... (Press 'v' to stop)[/bold red]")
                except Exception as e:
                    self.ui.display_error(f"Audio Error: {e}")
                    self.is_recording = False
                    self.ui.set_ui_mode("NORMAL")
            else:
                self.is_recording = False
                self.ui.set_ui_mode("NORMAL")
                base64_audio = self.audio_manager.stop_recording()
                if base64_audio:
                    asyncio.create_task(self.handle_audio_input(base64_audio))

        # Inyectamos el callback en la UI (si es TerminalUI)
        if hasattr(self.ui, 'set_audio_callback'):
            self.ui.set_audio_callback(toggle_audio)
        
        self.ui.display_message("[bold green]🎤 Voice Mode active (Press 'v' in NORMAL mode to toggle)[/bold green]")

        model = self.config_manager.get("model_name", "Unknown")
        self.ui.display_panel(
            title="🤖 System Ready",
            message=f"[bold cyan]🤖 Paser Autonomous Agent (Debug Mode)[/bold cyan]\n"
                    f"[dim]Model: {model} | Temp: {self.temperature}[/dim]",
            style="magenta"
        )

        history = FileHistory(".chat_history")
        while not self.should_exit:
            try:
                user_input = await self.ui.request_input("\u2502 \u279c ", history=history)
            except Exception as e:
                self.ui.display_error(f"Critical UI Error: {e}")
                break
            if not user_input: continue
            if await self.command_handler.handle(user_input): continue
            try:
                with self.ui.get_spinner("", "cyan", newline=True):
                    result = await self.executor.execute(
                        user_input=user_input, 
                        thinking_enabled=self.thinking_enabled, 
                        get_confirmation_callback=self.ui.request_input
                    )
                if result:
                    cleaned_result = re.sub(r'<[^>]+>.*?</[^>]+>', '', result, flags=re.DOTALL)
                    self.ui.display_message(cleaned_result)
            except Exception as e: 
                self.ui.display_error(f"Error: {e}")

    def _initialize_chat(self):
        try:
            self.assistant.start_chat(self.config_manager.get("model_name", "models/gemma-2-27B-it"), self.system_instruction, self.temperature)
            self._initialized_event.set()
        except Exception as e: self._init_error = e

    def save_session(self, name):
        session_dir = os.path.join(os.path.dirname(__file__), '..', '..', 'sessions')
        os.makedirs(session_dir, exist_ok=True)
        filepath = os.path.join(session_dir, f"{name}.json")
        
        history = self.assistant.get_history()
        data = {
            "model": self.assistant.current_model,
            "temperature": self.temperature,
            "history": history
        }
        
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=4)
        return filepath

    def load_session(self, name):
        session_dir = os.path.join(os.path.dirname(__file__), '..', '..', 'sessions')
        filepath = os.path.join(session_dir, f"{name}.json")
        
        if not os.path.exists(filepath):
            raise FileNotFoundError(f"Sesión {name} no encontrada.")
            
        with open(filepath, "r", encoding="utf-8") as f:
            data = json.load(f)
            
        self.temperature = data.get("temperature", self.temperature)
        self.assistant.load_history(
            data["history"], 
            data["model"], 
            self.temperature
        )

    async def handle_audio_input(self, base64_audio: str):
        try:
            import base64
            audio_bytes = base64.b64decode(base64_audio)
            
            with self.ui.get_spinner("Processing audio...", "magenta", newline=True):
                result = await self.executor.execute(
                    user_input=audio_bytes, 
                    thinking_enabled=self.thinking_enabled, 
                    get_confirmation_callback=self.ui.request_input
                )
                
                if result:
                    cleaned_result = re.sub(r'<[^>]+>.*?</[^>]+>', '', result, flags=re.DOTALL)
                    self.ui.display_message(cleaned_result)
                else:
                    self.ui.display_message("No se pudo obtener una respuesta del audio.")
        except Exception as e:
            self.ui.display_error(f"Error processing audio: {e}")
