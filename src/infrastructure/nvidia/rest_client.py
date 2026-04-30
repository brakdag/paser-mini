import httpx
import os
import json
import logging
from typing import Generator, Any, Dict

logger = logging.getLogger(__name__)

class NvidiaRestClient:
    def __init__(self):
        self.api_key = os.getenv("NVIDIA_API_KEY")
        self.base_url = "https://integrate.api.nvidia.com/v1"
        self.headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "Accept": "application/json"
        }

    def chat_completions(self, payload: Dict[str, Any], stream: bool = False) -> Any:
        url = f"{self.base_url}/chat/completions"
        payload["stream"] = stream
        
        if stream:
            return self._stream_request(url, payload)
        
        from src.infrastructure.nvidia.retry_handler import NvidiaRetryHandler
        handler = NvidiaRetryHandler()
        try:
            return handler.execute(self._post_request, url, payload)
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                # Solo imprimimos si no es una verificación silenciosa
                if payload.get("max_tokens") != 1:
                    print("\n[!] Error: El modelo solicitado no está disponible (404).")
                return None
            raise e

    def _post_request(self, url, payload):
        with httpx.Client() as client:
            response = client.post(url, headers=self.headers, json=payload, timeout=60.0)
            response.raise_for_status()
            return response.json()

    def _stream_request(self, url: str, payload: Dict[str, Any]) -> Generator[str, None, None]:
        with httpx.stream("POST", url, headers=self.headers, json=payload, timeout=60.0) as response:
            response.raise_for_status()
            for line in response.iter_lines():
                if line.startswith("data: ") and line != "data: [DONE]":
                    data = json.loads(line[6:])
                    content = data.get("choices", [{}])[0].get("delta", {}).get("content", "")
                    if content:
                        yield content

    def get(self, endpoint: str) -> Any:
        with httpx.Client() as client:
            response = client.get(f"{self.base_url}/{endpoint}", headers=self.headers)
            response.raise_for_status()
            return response.json()
