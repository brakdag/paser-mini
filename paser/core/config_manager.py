import json
import os

class ConfigManager:
    def __init__(self, config_path):
        self.config_path = config_path
        self.config = self._load_config()

    def _load_config(self):
        try:
            if os.path.exists(self.config_path):
                with open(self.config_path, "r") as f:
                    return json.load(f)
        except Exception:
            pass
        return {}

    def get(self, key, default=None):
        return self.config.get(key, default)

    def set(self, key, value):
        """Sets a configuration value and persists it to the config file."""
        self.config[key] = value
        try:
            with open(self.config_path, "w") as f:
                json.dump(self.config, f, indent=4)
        except Exception as e:
            # We use a simple print or logger here as we are in the config manager
            print(f"Error saving config: {e}")
