import os
import re
import logging
import json
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
            match = re.search(r'lang_chang_(\d+)\.json', f)
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
        filename = f"lang_chang_{new_count}.json"
        filepath = os.path.join(save_dir, filename)
        
        payload = {
            "system_instruction": system_instruction,
            "history": history,
            "current_message": current_message.decode('utf-8', errors='replace') if isinstance(current_message, bytes) else current_message
        }
        
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(payload, f, indent=4, ensure_ascii=False)
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
