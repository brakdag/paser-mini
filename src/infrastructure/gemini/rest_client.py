import httpx
import os
import json
import time
import logging
from typing import Generator, Any, Dict

logger = logging.getLogger(__name__)

class GeminiRestClient:
    def __init__(self):
        self.api_key = os.getenv("GOOGLE_API_KEY")
        self.base_url = "https://generativelanguage.googleapis.com/v1beta/models"
        self.headers = {"Content-Type": "application/json", "x-goog-api-key": self.api_key}

    def _request(self, method: str, url: str, payload: Dict[str, Any], stream: bool = False) -> Any:
        start_time = time.perf_counter()
        with httpx.Client() as client:
            response = client.post(url, headers=self.headers, json=payload, timeout=60.0)
            latency = time.perf_counter() - start_time
            response.raise_for_status()
            logger.info(f"Gemini API Latency: {latency:.2f}s")
            return response.json()

    def generate_content(self, model: str, payload: Dict[str, Any], stream: bool = False) -> Any:
        model_name = model.replace("models/", "") if model else "gemini-2.0-flash"
        url = f"{self.base_url}/{model_name}:{'streamGenerateContent' if stream else 'generateContent'}"
        
        if stream:
            return self._stream_request(url, payload)
        return self._request("POST", url, payload)

    def list_models(self) -> Any:
        url = f"{self.base_url.replace('/models', '')}/models"
        with httpx.Client() as client:
            response = client.get(url, headers=self.headers)
            response.raise_for_status()
            return response.json().get("models", [])

    def _stream_request(self, url: str, payload: Dict[str, Any]) -> Generator[str, None, None]:
        with httpx.stream("POST", url, headers=self.headers, json=payload, timeout=60.0) as response:
            response.raise_for_status()
            for line in response.iter_lines():
                if line.startswith("data: "):
                    data = json.loads(line[6:])
                    if "candidates" in data:
                        part = data["candidates"][0]["content"]["parts"][0]
                        thought = part.get("thought", "")
                        text = part.get("text", "")
                        if thought:
                            yield f"<thought>{thought}</thought>"
                        if text:
                            yield text
