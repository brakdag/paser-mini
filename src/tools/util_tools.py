import json
import os
import logging
from typing import Optional
from . import context, ToolError

logger = logging.getLogger("tools")

def validateJson(json_string: str) -> str:
    """Validates if a string is a valid JSON."""
    try:
        json.loads(json_string)
        return "El JSON es valido."
    except json.JSONDecodeError as e:
        raise ToolError(f"JSON invalido: {str(e)}")
