import httpx
import os
import json
import time
import logging
import asyncio
from typing import AsyncGenerator, Any, Dict

logger = logging.getLogger(__name__)

class GeminiRestClient:
    def __init__(self):
        self.api_key = os.getenv("GOOGLE_API_KEY")
        if self.api_key is None:
            raise ValueError("GOOGLE_API_KEY environment variable is not set")
        self.base_url = "https://generativelanguage.googleapis.com/v1beta/models"
        
        # Initialize a persistent ASYNC client with connection pooling
        self.client = httpx.AsyncClient(
            headers={"Content-Type": "application/json", "x-goog-api-key": self.api_key},
            timeout=httpx.Timeout(360.0, connect=10.0),
            limits=httpx.Limits(max_connections=10, max_keepalive_connections=5)
        )

    async def _request(self, method: str, url: str, payload: Dict[str, Any], stream: bool = False) -> Any:
        start_time = time.perf_counter()
        try:
            # Use the persistent async client
            response = await self.client.post(url, json=payload)
            latency = time.perf_counter() - start_time
            response.raise_for_status()
            logger.info(f"Gemini API Latency: {latency:.2f}s")
            return response.json()
        except httpx.HTTPStatusError as e:
            logger.error(f"HTTP Error: {e.response.status_code} - {e.response.text}")
            raise
        except asyncio.CancelledError:
            logger.info("Gemini request was cancelled by the user.")
            raise
        except Exception as e:
            logger.error(f"Request Error: {e}")
            raise

    async def generate_content(self, model: str, payload: Dict[str, Any], stream: bool = False) -> Any:
        model_name = model.replace("models/", "") if model else "gemini-2.0-flash"
        url = f"{self.base_url}/{model_name}:{'streamGenerateContent' if stream else 'generateContent'}"
        
        if stream:
            return self._stream_request(url, payload)
        return await self._request("POST", url, payload)

    async def list_models(self) -> Any:
        url = f"{self.base_url.replace('/models', '')}/models"
        try:
            response = await self.client.get(url)
            response.raise_for_status()
            return response.json().get("models", [])
        except Exception as e:
            logger.error(f"Error listing models: {e}")
            return []

    async def _stream_request(self, url: str, payload: Dict[str, Any]) -> AsyncGenerator[str, None]:
        # Use the persistent async client's stream method
        async with self.client.stream("POST", url, json=payload) as response:
            response.raise_for_status()
            async for line in response.aiter_lines():
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

    async def close(self):
        """Explicitly close the connection pool."""
        await self.client.aclose()
