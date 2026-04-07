import json
import os
import time
from typing import List, Dict, Optional

class EventManager:
    """Gestiona la persistencia y recuperación de eventos temporizados (timers)."""
    
    def __init__(self, storage_path: str = ".paser_events.json"):
        self.storage_path = storage_path

    def _load_events(self) -> List[Dict]:
        if not os.path.exists(self.storage_path):
            return []
        try:
            with open(self.storage_path, "r") as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError):
            return []

    def _save_events(self, events: List[Dict]):
        try:
            with open(self.storage_path, "w") as f:
                json.dump(events, f, indent=4)
        except IOError as e:
            print(f"Error saving events: {e}")

    def add_event(self, seconds: int, message: str):
        """Programa un evento para el futuro."""
        # Aseguramos que seconds sea un número válido
        try:
            seconds = int(seconds)
        except ValueError:
            seconds = 0
            
        events = self._load_events()
        # Si segundos es 0 o menos, el evento expira inmediatamente
        execution_time = time.time() + max(seconds, 0)
        events.append({
            "execution_time": execution_time,
            "message": message,
            "triggered": False
        })
        self._save_events(events)

    def check_expired_events(self) -> List[str]:
        """Revisa si hay eventos que ya deberían haberse ejecutado."""
        events = self._load_events()
        now = time.time()
        expired_messages = []
        updated = False

        for event in events:
            if not event["triggered"] and now >= event["execution_time"]:
                expired_messages.append(event["message"])
                event["triggered"] = True
                updated = True
        
        if updated:
            self._save_events(events)
            
        return expired_messages

# Instancia global para acceso desde las herramientas
event_manager = EventManager()