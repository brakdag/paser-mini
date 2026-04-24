import json
import os
import logging
from typing import Any

logger = logging.getLogger(__name__)

class ConfigManager:
    def __init__(self):
        self.config_path = os.path.join(os.path.dirname(__file__), '..', 'config', 'config.json')
        self.config = self._load_config()

    def _load_config(self) -> dict:
        try:
            if os.path.exists(self.config_path):
                with open(self.config_path, "r") as f:
                    return json.load(f)
        except Exception as e:
            logger.error(f"Error loading config: {e}")
        return {}

    def get(self, key: str, default: Any = None) -> Any:
        return self.config.get(key, default)

    def save(self, key: str, value: Any):
        self.config[key] = value
        try:
            with open(self.config_path, "w") as f:
                json.dump(self.config, f, indent=4)
        except Exception as e:
            logger.error(f"Error saving config: {e}")
