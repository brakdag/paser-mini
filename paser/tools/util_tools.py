import json
import os
import logging
from typing import Optional
from .core_tools import context, ToolError
from .validation import validate_args
from .schemas import ValidateJsonSchema, ValidateJsonFileSchema

logger = logging.getLogger("tools")

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
        raise ToolError(f"JSON inválido: {str(e)}")

@validate_args(ValidateJsonFileSchema)
def validate_json_file(path: str) -> str:
    """Validates if a file contains valid JSON."""
    try:
        safe_path = context.get_safe_path(path)
        with open(safe_path, 'r', encoding='utf-8') as f:
            content = f.read()
        return validate_json(json_string=content)
    except Exception as e:
        raise ToolError(f"Error al leer el archivo: {str(e)}")
