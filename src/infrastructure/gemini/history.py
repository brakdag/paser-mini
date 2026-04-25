import os
import re
import logging
from typing import Optional, Union, List, Dict, Any

logger = logging.getLogger(__name__)

def initialize_call_count(save_dir: str) -> int:
    """Finds the last used number in save_langchain to continue numbering."""
    if not os.path.exists(save_dir):
        return 0
    try:
        files = os.listdir(save_dir)
        numbers = []
        for f in files:
            match = re.search(r'lang_chang_(\d+)\.text', f)
            if match:
                numbers.append(int(match.group(1)))
        return max(numbers) if numbers else 0
    except Exception as e:
        logger.error(f"Error initializing call count: {e}")
        return 0

def save_payload(save_dir: str, call_count: int, system_instruction: Optional[str], history: List[Dict[str, Any]], current_message: Union[str, bytes]) -> int:
    """Saves the full prompt (system + history + current) to disk using dictionary-based history."""
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
            role = content.get('role', 'unknown').upper()
            parts = content.get('parts', [])
            text_parts = []
            
            for part in parts:
                if isinstance(part, dict):
                    if 'text' in part and part['text']:
                        text_parts.append(part['text'])
                    elif 'inline_data' in part:
                        text_parts.append("[Binary Data/Image/Audio]")
                    else:
                        text_parts.append("[Unknown Part]")
                elif isinstance(part, str):
                    text_parts.append(part)
                else:
                    text_parts.append(f"[Unsupported Part Type: {type(part).__name__}]")
            
            lines.append(f"[{role}]: " + "\n".join(text_parts))
            lines.append("-" * 20)
        
        lines.append("\n" + "="*30 + "\n")
        lines.append("=== CURRENT MESSAGE ===")
        if isinstance(current_message, bytes):
            lines.append("[Audio/Binary Data]")
        else:
            lines.append(str(current_message))

        if history and history[-1].get('role', '').lower() == 'model':
            last_resp = history[-1]
            parts = last_resp.get('parts', [])
            resp_text = " ".join([p.get('text', '') for p in parts if isinstance(p, dict) and p.get('text')])
            lines.append("\n" + "="*30 + "\n")
            lines.append("=== MODEL RESPONSE ===")
            lines.append(resp_text)
        
        with open(filepath, "w", encoding="utf-8") as f:
            f.write("\n".join(lines))
        return new_count
    except Exception as e:
        logger.error(f"Failed to save langchain payload: {e}")
        return call_count

def get_history_serializable(history: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Returns the history as is, since it is already composed of serializable dictionaries."""
    return history

def load_history_contents(history_data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Returns the history data directly as it is already in the required dictionary format."""
    return history_data
