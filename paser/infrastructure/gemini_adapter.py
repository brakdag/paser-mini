from typing import Generator, Optional, Any
from google import genai
from google.genai import types
from google.genai.errors import ClientError
from paser.core.interfaces import IAIAssistant

class GeminiAdapter(IAIAssistant):
    def __init__(self):
        self.client = genai.Client()
        self.chat: Any = None
        self._current_model: Optional[str] = None

    @property
    def current_model(self) -> Optional[str]:
        return self._current_model

    def start_chat(self, model_name: str, system_instruction: str, temperature: float):
        self._current_model = model_name
        
        # Validar el modelo antes de iniciar
        available_models = self.get_available_models()
        if model_name not in available_models:
            raise ValueError(f"Modelo no disponible: {model_name}. Use /models para ver los disponibles.")
        
        config_params = {"temperature": temperature}
        history = []
        
        # Intentar aplicar system_instruction de manera segura
        try:
            config_params["system_instruction"] = system_instruction
            # Intentar crear chat para verificar compatibilidad de system_instruction
            self.client.chats.create(
                model=model_name,
                config=types.GenerateContentConfig(**config_params),
                history=[]
            )
        except Exception:
            # Si falla, probablemente sea Gemma u otro modelo que no admite system_instruction en la config
            config_params["system_instruction"] = None
            history = [
                types.Content(
                    role="user",
                    parts=[types.Part.from_text(text=f"System Instructions: {system_instruction}")]
                ),
                types.Content(
                    role="model",
                    parts=[types.Part.from_text(text="Understood. I will follow these instructions.")]
                ),
            ]

        try:
            self.chat = self.client.chats.create(
                model=model_name,
                config=types.GenerateContentConfig(**config_params),
                history=history
            )
        except ClientError as e:
            raise RuntimeError(f"Error al iniciar chat con el modelo {model_name}: {e}")

    def send_message_stream(self, message: str) -> Generator[str, None, None]:
        if not self.chat:
            yield ""
            return
        try:
            response = self.chat.send_message_stream(message)
            for chunk in response:
                if hasattr(chunk, 'text') and chunk.text:
                    yield chunk.text
        except ClientError as e:
            if getattr(e, 'status_code', None) == 429 or '429' in str(e):
                yield f"\n⚠️ Error: Cuota de API excedida (429). Por favor, espera un momento o cambia el modelo. {e}"
            else:
                raise e

    def send_message(self, message: str) -> Any:
        if not self.chat:
            return None
        try:
            return self.chat.send_message(message)
        except ClientError as e:
            if getattr(e, 'status_code', None) == 429 or '429' in str(e):
                # Retornamos un string que el AutonomousExecutor._extract_text pueda manejar
                return f"⚠️ Error: Cuota de API excedida (429). Por favor, espera un momento o cambia el modelo. {e}"
            raise e

    def get_history(self) -> list:
        if not self.chat:
            return []
        # Convertir objetos de historial a diccionarios serializables
        return [
            {"role": content.role, "parts": [part.text for part in content.parts if part.text]}
            for content in self.chat.history
        ]

    def load_history(self, history_data: list, model_name: str, temperature: float):
        self._current_model = model_name
        history = [
            types.Content(role=item["role"], parts=[types.Part.from_text(text=text) for text in item["parts"]])
            for item in history_data
        ]
        
        self.chat = self.client.chats.create(
            model=model_name,
            config=types.GenerateContentConfig(temperature=temperature),
            history=history
        )

    def get_available_models(self) -> list:
        # Relaxed filtering to ensure models appear
        models = self.client.models.list()
        return [m.name for m in models if m.name and ('gemini' in m.name.lower() or 'gemma' in m.name.lower())]
