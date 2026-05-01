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
        
        # Initialize a persistent client with connection pooling
        # We configure headers here so they are automatically sent with every request
        self.client = httpx.Client(
            headers={"Content-Type": "application/json", "x-goog-api-key": self.api_key},
            timeout=httpx.Timeout(360.0, connect=10.0), # Fast connect, long read
            limits=httpx.Limits(max_connections=10, max_keepalive_connections=5)
        )

    def _request(self, method: str, url: str, payload: Dict[str, Any], stream: bool = False) -> Any:
        start_time = time.perf_counter()
        try:
            # Use the persistent client instead of creating a new one
            response = self.client.post(url, json=payload)
            latency = time.perf_counter() - start_time
            response.raise_for_status()
            logger.info(f"Gemini API Latency: {latency:.2f}s")
            return response.json()
        except httpx.HTTPStatusError as e:
            logger.error(f"HTTP Error: {e.response.status_code} - {e.response.text}")
            raise
        except Exception as e:
            logger.error(f"Request Error: {e}")
            raise

    def generate_content(self, model: str, payload: Dict[str, Any], stream: bool = False) -> Any:
        model_name = model.replace("models/", "") if model else "gemini-2.0-flash"
        url = f"{self.base_url}/{model_name}:{'streamGenerateContent' if stream else 'generateContent'}"
        
        if stream:
            return self._stream_request(url, payload)
        return self._request("POST", url, payload)

    def list_models(self) -> Any:
        url = f"{self.base_url.replace('/models', '')}/models"
        try:
            response = self.client.get(url)
            response.raise_for_status()
            return response.json().get("models", [])
        except Exception as e:
            logger.error(f"Error listing models: {e}")
            return []

    def _stream_request(self, url: str, payload: Dict[str, Any]) -> Generator[str, None, None]:
        # Use the persistent client's stream method
        with self.client.stream("POST", url, json=payload) as response:
            response.raise_for_status()
            for line in response.iter_lines():
                if line.startswith("data: "):
                    try:
                        data = json.loads(line[6:])
                        if "candidates" in data:
                            part = data["candidates"][0]["content"]["parts"][0]
                            thought = part.get("thought", "")
                            text = part.get("text", "")
                            if thought:
                                yield f"<thought>{thought}</thought>"
                            if text:
                                yield text
                    except json.JSONDecodeError:
                        continue

    def close(self):
        """Explicitly close the connection pool."""
        self.client.close()
