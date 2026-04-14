import json
import os
import logging
from typing import Optional
from .core_tools import context, ToolError
from .validation import validate_args
from .schemas import ValidateJsonSchema

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
