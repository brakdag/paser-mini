import httpx
import os
import json
import logging
from typing import AsyncGenerator, Any, Dict

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
        self.client = httpx.AsyncClient(timeout=60.0)

    async def chat_completions(self, payload: Dict[str, Any], stream: bool = False) -> Any:
        url = f"{self.base_url}/chat/completions"
        payload["stream"] = stream
        
        if stream:
            return self._stream_request(url, payload)
        
        from src.infrastructure.nvidia.retry_handler import NvidiaRetryHandler
        handler = NvidiaRetryHandler()
        try:
            return await handler.execute(self._post_request, url, payload)
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                if payload.get("max_tokens") != 1:
                    print("\n[!] Error: El modelo solicitado no está disponible (404).")
                return None
            raise e

    async def _post_request(self, url, payload):
        response = await self.client.post(url, headers=self.headers, json=payload)
        if response.status_code == 404:
            return None
        response.raise_for_status()
        return response.json()

    async def _stream_request(self, url: str, payload: Dict[str, Any]) -> AsyncGenerator[str, None]:
        async with self.client.stream("POST", url, headers=self.headers, json=payload) as response:
            response.raise_for_status()
            async for line in response.aiter_lines():
                if line.startswith("data: ") and line != "data: [DONE]":
                    try:
                        data = json.loads(line[6:])
                        content = data.get("choices", [{}])[0].get("delta", {}).get("content", "")
                        if content:
                            yield content
                    except json.JSONDecodeError:
                        continue

    async def get(self, endpoint: str) -> Any:
        response = await self.client.get(f"{self.base_url}/{endpoint}", headers=self.headers)
        response.raise_for_status()
        return response.json()

    async def close(self):
        await self.client.aclose()
