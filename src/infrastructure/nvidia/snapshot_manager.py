import logging
from typing import Optional, Union
from src.infrastructure.gemini import history

logger = logging.getLogger(__name__)

class SnapshotManager:
    def __init__(self, save_dir: str = "."):
        self.save_dir = save_dir
        self.call_count = history.initialize_call_count(self.save_dir)

    def save(self, system_instruction: Optional[str], chat_history: list, current_message: Union[str, bytes]) -> bool:
        if not chat_history:
            return False
        
        last_user_msg = None
        for content in reversed(chat_history):
            if content.get('role', '').lower() == 'user':
                last_user_msg = content.get('content', '')
                break
        
        if last_user_msg:
            self.call_count = history.save_payload(
                self.save_dir, 
                self.call_count, 
                system_instruction, 
                chat_history, 
                last_user_msg
            )
            return True
        return False
