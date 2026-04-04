import json
import sys
import time
import itertools
import threading
from passer.core.interfaces import IAIAssistant
from passer.tools import tools_functions as tf

class Spinner:
    def __init__(self, message="Procesando..."):
        self.message = message
        self.stop_running = threading.Event()
        self.spin_thread = None

    def _spin(self):
        spinner = itertools.cycle(['|', '/', '-', '\\'])
        while not self.stop_running.is_set():
            sys.stdout.write(f"\r{next(spinner)} {self.message}")
            sys.stdout.flush()
            time.sleep(0.1)
        sys.stdout.write("\r" + " " * (len(self.message) + 2) + "\r")
        sys.stdout.flush()

    def __enter__(self):
        self.spin_thread = threading.Thread(target=self._spin)
        self.spin_thread.start()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.stop_running.set()
        if self.spin_thread:
            self.spin_thread.join()

class ChatManager:
    def __init__(self, assistant: IAIAssistant, tools: dict, system_instruction: str):
        self.assistant = assistant
        self.tools = tools
        self.system_instruction = system_instruction
        self.thinking_enabled = True
        self.temperature = 0.7
        self.tool_messages = {
            "leer_archivo": "Leyendo archivo...",
            "escribir_archivo": "Escribiendo archivo...",
            "borrar_archivo": "Borrando archivo...",
            "listar_archivos": "Listando archivos...",
            "buscar_en_internet": "Buscando en internet...",
            "leer_url": "Consultando web...",
            "leer_lineas": "Leyendo archivo...",
            "leer_cabecera": "Leyendo archivo..."
        }

    def run(self):
        self._initialize_chat()
        
        # ASCII Box for connection info
        model_name = self.assistant.current_model or "Desconocido"
        msg = f" Conectado a: Google | Modelo: {model_name} "
        border = "+" + "-" * len(msg) + "+"
        print(f"\n{border}")
        print(f"|{msg}|")
        print(f"{border}\n")
        
        while True:
            try:
                user_input = input("Tú: ")
            except (EOFError, KeyboardInterrupt): break
            if not user_input: continue
            if user_input.strip() == ':q': break
            
            # Comandos
            if user_input.strip().startswith('/cd '):
                tf.set_project_root(user_input.strip()[4:])
                print(f"Directorio: {tf.PROJECT_ROOT}")
                continue
            elif user_input.strip() == '/thinking':
                self.thinking_enabled = not self.thinking_enabled
                print(f"Pensamientos: {'Visible' if self.thinking_enabled else 'Oculto'}")
                continue
            elif user_input.strip() == '/models':
                models = self.assistant.get_available_models()
                for i, m in enumerate(models): print(f"{i}: {m}")
                choice = input("Modelo: ")
                try:
                    idx = int(choice)
                    model_name = models[idx]
                    self.temperature = float(input(f"Temp (0-1, default {self.temperature}): ") or self.temperature)
                    self.assistant.start_chat(model_name, self.system_instruction, self.temperature)
                except: print("Error.")
                continue
            
            # Ejecución autónoma
            self._autonomous_loop(user_input)

    def _initialize_chat(self):
        self.assistant.start_chat("models/gemma-4-31b-it", self.system_instruction, self.temperature)

    def _autonomous_loop(self, user_input):
        current_input = user_input
        while True:
            full_response_text = ""
            print("Gemini: ", end="")
            in_tool_block = False
            for text_chunk in self.assistant.send_message_stream(current_input):
                full_response_text += text_chunk
                
                # Detect start of TOOL_CALL block
                if "<TOOL_CALL>" in text_chunk:
                    in_tool_block = True
                
                if in_tool_block:
                    if "</TOOL_CALL>" in text_chunk:
                        in_tool_block = False
                    continue # Do not print this chunk
                    
                # Print non-tool chunks
                for line in text_chunk.splitlines(keepends=True):
                    if self.thinking_enabled or not line.lstrip().startswith('*'):
                        print(line, end="", flush=True)
            print("")
            
            # Parseo TOOL_CALL
            start_tag, end_tag = "<TOOL_CALL>", "</TOOL_CALL>"
            s = full_response_text.find(start_tag)
            e = full_response_text.find(end_tag)
            tool_json = full_response_text[s+len(start_tag):e] if s != -1 and e != -1 else None
            
            if tool_json:
                try:
                    tool_call = json.loads(tool_json)
                    f_name = tool_call.get("name")
                    f_args = tool_call.get("args", {})
                    if f_name in self.tools:
                        if f_name == "borrar_archivo":
                            confirm = input(f"\n¿Borrar '{f_args.get('path')}'? (y/n): ")
                            res = self.tools[f_name](**f_args) if confirm == 'y' else "Cancelado."
                        else:
                            msg = self.tool_messages.get(f_name, "Procesando...")
                            with Spinner(msg):
                                res = self.tools[f_name](**f_args)
                        # Enviar respuesta y obtener la siguiente del modelo
                        response = self.assistant.send_message(f"<TOOL_RESPONSE>{json.dumps({'status': 'success', 'data': res})}</TOOL_RESPONSE>")
                        
                        # Si hay un nuevo paso, procesarlo
                        if response and response.text:
                            current_input = response.text # O quizás no necesitamos inputs si el chat sigue
                        current_input = "" 
                        continue

                except Exception as e: print(f"Error: {e}")
            break
