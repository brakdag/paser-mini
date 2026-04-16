import os
import re
import logging
from typing import Optional, Union
from google.genai import types

logger = logging.getLogger(__name__)

def initialize_call_count(save_dir: str) -> int:
    """Finds the last used number in save_langchain to continue numbering."""
    if not os.path.exists(save_dir):
        return 0
    files = os.listdir(save_dir)
    numbers = []
    for f in files:
        match = re.search(r'lang_chang_(\d+)\.text', f)
        if match:
            numbers.append(int(match.group(1)))
    return max(numbers) if numbers else 0

def save_payload(save_dir: str, call_count: int, system_instruction: Optional[str], history: list, current_message: Union[str, bytes]) -> int:
    """Saves the full prompt (system + history + current) to disk."""
    try:
        new_count = call_count + 1
        filename = f"lang_chang_{new_count}.text"
        filepath = os.path.join(save_dir, filename)
        
        lines = []
        lines.append("=== SYSTEM INSTRUCTION ===")
        lines.append(system_instruction or "No system instruction set.")
        lines.append("\n" + "="*30 + "\n")
        
        lines.append("=== CONVERSATION HISTORY ===")
        for content in history:
            role = content.role.upper()
            text_parts = []
            for part in content.parts:
                if hasattr(part, 'text') and part.text:
                    text_parts.append(part.text)
                elif hasattr(part, 'inline_data') or (hasattr(part, 'data') and part.data):
                    text_parts.append("[Binary Data/Image/Audio]")
                else:
                    text_parts.append("[Unknown Part]")
            
            lines.append(f"[{role}]: " + "\n".join(text_parts))
            lines.append("-" * 20)
        
        lines.append("\n" + "="*30 + "\n")
        lines.append("=== CURRENT MESSAGE ===")
        if isinstance(current_message, bytes):
            lines.append("[Audio/Binary Data]")
        else:
            lines.append(current_message)

        if history and history[-1].role.lower() == 'model':
            last_resp = history[-1]
            resp_text = " ".join([p.text for p in last_resp.parts if hasattr(p, 'text') and p.text])
            lines.append("\n" + "="*30 + "\n")
            lines.append("=== MODEL RESPONSE ===")
            lines.append(resp_text)
        
        with open(filepath, "w", encoding="utf-8") as f:
            f.write("\n".join(lines))
        return new_count
    except Exception as e:
        logger.error(f"Failed to save langchain payload: {e}")
        return call_count

def get_history_serializable(history: list) -> list:
    """Convertir objetos de historial a diccionarios serializables."""
    return [
        {"role": content.role, "parts": [part.text for part in content.parts if hasattr(part, 'text') and part.text]}
        for content in history
    ]

def load_history_contents(history_data: list) -> list:
    """Convierte datos de historial serializados en objetos types.Content."""
    return [
        types.Content(role=item["role"], parts=[types.Part.from_text(text=text) for text in item["parts"]])
        for item in history_data
    ]
