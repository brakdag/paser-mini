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

    def _request_with_retry(self, method: str, url: str, payload: Dict[str, Any], stream: bool = False) -> Any:
        max_retries = 3
        for attempt in range(max_retries):
            try:
                start_time = time.perf_counter()
                with httpx.Client() as client:
                    response = client.post(url, headers=self.headers, json=payload, timeout=60.0)
                    latency = time.perf_counter() - start_time
                    if response.status_code in [429, 500, 503]:
                        raise httpx.HTTPStatusError("Retryable error", request=response.request, response=response)
                    response.raise_for_status()
                    logger.info(f"Gemini API Latency: {latency:.2f}s")
                    return response.json()
            except (httpx.HTTPStatusError, httpx.RequestError) as e:
                if attempt == max_retries - 1: raise e
                time.sleep(2 ** attempt) # Exponential backoff

    def generate_content(self, model: str, payload: Dict[str, Any], stream: bool = False) -> Any:
        model_name = model.replace("models/", "") if model else "gemini-2.0-flash"
        url = f"{self.base_url}/{model_name}:{'streamGenerateContent' if stream else 'generateContent'}"
        
        if stream:
            return self._stream_request(url, payload)
        return self._request_with_retry("POST", url, payload)

    def _stream_request(self, url: str, payload: Dict[str, Any]) -> Generator[str, None, None]:
        with httpx.stream("POST", url, headers=self.headers, json=payload, timeout=60.0) as response:
            response.raise_for_status()
            for line in response.iter_lines():
                if line.startswith("data: "):
                    data = json.loads(line[6:])
                    if "candidates" in data:
                        yield data["candidates"][0]["content"]["parts"][0].get("text", "")
