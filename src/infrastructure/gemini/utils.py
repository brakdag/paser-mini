import re
import json
import base64
from google.genai import types

def prepare_message_parts(message: str) -> list[types.Part]:
    """
    Convierte un mensaje de texto en una lista de partes multimodales.
    Si detecta un <TOOL_RESPONSE> con datos de imagen, lo convierte en un Part de imagen.
    """
    parts = []
    pattern = r'<(TOOL_RESPONSE)>(.*?)</\1>'
    last_pos = 0
    
    for match in re.finditer(pattern, message, re.DOTALL):
        text_before = message[last_pos:match.start()]
        if text_before:
            parts.append(types.Part.from_text(text=text_before))
        
        content = match.group(2).strip()
        try:
            data = json.loads(content)
            if data.get("status") == "success" and isinstance(data.get("data"), dict) and "mime_type" in data["data"]:
                img_data = data["data"]
                parts.append(
                    types.Part.from_bytes(
                        data=base64.b64decode(img_data["data"]),
                        mime_type=img_data["mime_type"]
                    )
                )
            else:
                parts.append(types.Part.from_text(text=match.group(0)))
        except json.JSONDecodeError:
            parts.append(types.Part.from_text(text=match.group(0)))
        
        last_pos = match.end()
    
    text_after = message[last_pos:]
    if text_after:
        parts.append(types.Part.from_text(text=text_after))
        
    return parts

def get_available_models(client) -> list:
    """Obtiene la lista de modelos disponibles filtrando por Gemini/Gemma."""
    models = client.models.list()
    return [m.name for m in models if m.name and ('gemini' in m.name.lower() or 'gemma' in m.name.lower())]

def count_tokens(client, model, contents) -> int:
    """Cuenta los tokens de un contenido dado utilizando la API de Gemini."""
    response = client.models.count_tokens(
        model=model,
        contents=contents
    )
    return response.total_tokens
