import datetime
import time
import ast
import operator
import logging
import json
import os
from typing import Optional
from paser.infrastructure.gemini_adapter import GeminiAdapter
from .core_tools import context
from .validation import validate_args
from .schemas import ValidateJsonSchema, ValidateJsonFileSchema

logger = logging.getLogger("tools")

def retry_request(func):
    def wrapper(*args, **kwargs):
        max_retries = 3
        backoff_factor = 1
        for i in range(max_retries):
            try:
                return func(*args, **kwargs)
            except Exception as e:
                if i == max_retries - 1:
                    raise e
                sleep_time = backoff_factor * (2 ** i)
                logger.warning(f"Error in {func.__name__}, retrying in {sleep_time} seconds. Attempt {i+1}/{max_retries}. Error: {e}")
                time.sleep(sleep_time)
    return wrapper

def get_time(zona_horaria: str) -> str:
    now_utc = datetime.datetime.now(datetime.timezone.utc)
    return f"La hora actual en {zona_horaria} (simulado UTC) es: {now_utc.strftime('%H:%M:%S')}"

def get_cwd() -> str:
    import os
    return os.getcwd()

@validate_args(ValidateJsonSchema)
def validate_json(json_string: str) -> str:
    """Validates if a string is a valid JSON."""
    try:
        json.loads(json_string)
        return "✅ El JSON es válido."
    except json.JSONDecodeError as e:
        return f"❌ JSON inválido: {str(e)}"

@validate_args(ValidateJsonFileSchema)
def validate_json_file(path: str) -> str:
    """Validates if a file contains valid JSON."""
    try:
        safe_path = context.get_safe_path(path)
        with open(safe_path, 'r', encoding='utf-8') as f:
            content = f.read()
        return validate_json(json_string=content)
    except Exception as e:
        return f"❌ Error al leer el archivo: {str(e)}"

def query_ai(prompt: str, temperature: float = 0.9, model: str = None, context_str: str = None) -> str:
    """
    Queries another AI instance for a second opinion, alternative perspectives, or to break reasoning loops.
    By default, it uses the same model as the agent but with a high temperature (0.9) for 'out-of-the-box' thinking.
    """
    try:
        adapter = GeminiAdapter()
        
        # Determine model to use
        if not model:
            # Try to get the current model from the system config
            try:
                config_path = os.path.join(os.path.dirname(__file__), '..', 'config', 'config.json')
                with open(config_path, 'r') as f:
                    config = json.load(f)
                model = config.get("model_name")
            except Exception as e:
                logger.warning(f"Could not read config for model_name: {e}")

            # Fallback if config read failed or model_name is missing
            if not model:
                try:
                    available = adapter.get_available_models()
                    model = next((m for m in available if 'pro' in m.lower()), available[0])
                except Exception:
                    model = "gemini-1.5-flash"

        # Construct the prompt with context if provided
        full_prompt = prompt
        if context_str:
            full_prompt = f"Context:\n{context_str}\n\nQuestion: {prompt}"

        # System instruction for the reflection agent
        system_instruction = (
            "You are a specialized AI consultant providing a second opinion. "
            "Your goal is to be critical, identify blind spots, and offer alternative "
            "perspectives or 'out-of-the-box' solutions. Be concise and direct."
        )

        adapter.start_chat(model, system_instruction, temperature)
        response = adapter.send_message(full_prompt)
        
        return response.text if hasattr(response, 'text') else str(response)
    except Exception as e:
        logger.error(f"Error in query_ai: {e}")
        return f"Error querying AI: {str(e)}"
