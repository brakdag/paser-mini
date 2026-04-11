import json
import os
from datetime import datetime, timedelta
from typing import Dict, Any

class QuotaTracker:
    """
    Tracks the number of API requests made per model, resetting daily at 5:00 AM local time.
    Also manages known RPD limits for each model.
    """
    def __init__(self, storage_path: str = ".paser_quota.json"):
        self.storage_path = storage_path
        # Default limits based on AI Studio / User Screenshot
        self.default_limits = {
            "models/gemini-3.1-flash-lite": 500,
            "models/gemma-4-31b-it": 1500,
            "models/gemma-4-26b-it": 1500,
            "models/gemini-3-flash": 20,
            "models/gemini-2.5-flash": 20,
            "models/gemini-2-flash-lite": 20,
            "models/gemma-3-1b-it": 14400,
            "models/gemma-3-2b-it": 14400,
            "models/gemma-3-4b-it": 14400,
            "models/gemma-3-12b-it": 14400,
            "models/gemma-3-27b-it": 14400,
            "models/text-embedding-004": 1000,
            "models/text-embedding-005": 1000,
        }

    def _get_quota_date(self) -> any:
        now = datetime.now()
        if now.hour < 5:
            return (now - timedelta(days=1)).date()
        return now.date()

    def increment_and_get(self, model_name: str) -> int:
        quota_date = self._get_quota_date()
        data = self._load()
        
        if data.get("last_quota_date") != str(quota_date):
            data = {"last_quota_date": str(quota_date), "counts": {}, "limits": self.default_limits}
        
        counts = data.get("counts", {})
        counts[model_name] = counts.get(model_name, 0) + 1
        data["counts"] = counts
        
        self._save(data)
        return counts[model_name]

    def get_current_count(self, model_name: str) -> int:
        quota_date = self._get_quota_date()
        data = self._load()
        if data.get("last_quota_date") != str(quota_date):
            return 0
        return data.get("counts", {}).get(model_name, 0)

    def get_limit(self, model_name: str) -> int:
        """Returns the RPD limit for a specific model."""
        data = self._load()
        limits = data.get("limits", self.default_limits)
        return limits.get(model_name, 0) # 0 if unknown

    def _load(self) -> Dict[str, Any]:
        if os.path.exists(self.storage_path):
            try:
                with open(self.storage_path, 'r') as f:
                    return json.load(f)
            except (json.JSONDecodeError, IOError):
                pass
        return {"last_quota_date": "", "counts": {}, "limits": self.default_limits}

    def _save(self, data: Dict[str, Any]) -> None:
        try:
            with open(self.storage_path, 'w') as f:
                json.dump(data, f, indent=4)
        except IOError as e:
            print(f"Warning: Could not save quota data: {e}")
