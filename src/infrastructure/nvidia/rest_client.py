import httpx
import os
import json
import logging
import asyncio
import time
from collections import deque
from typing import AsyncGenerator, Any, Dict
from src.core.config_manager import ConfigManager

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
        self.config_manager = ConfigManager()
        
        # Control de RPM Dinámico
        self._lock = asyncio.Lock()
        self.request_timestamps = deque()

    async def _apply_rate_limit(self, current_tokens: int = 1000):
        """
        Implements sliding window logic and automatic RPM
        based on the global system configuration.
        """
        async with self._lock:
            # 1. Obtener configuración actual
            rpm_limit = int(self.config_manager.get("rpm_limit", 15))
            tpm_limit = int(self.config_manager.get("tpm_limit", 15000))
            auto_rpm_enabled = self.config_manager.get("auto_rpm_enabled", False)

            # 2. Ajuste de RPM Automático (Lógica espejo del ChatManager)
            if auto_rpm_enabled:
                rpm_limit = max(1, int(tpm_limit / max(current_tokens, 1000)))
                logger.debug(f"Nvidia Auto-RPM: Adjusted limit to {rpm_limit} based on tokens")

            now = asyncio.get_event_loop().time()
            min_interval = 60.0 / rpm_limit

            # 3. Sliding Window: Calculate wait based on the last request
            if self.request_timestamps:
                last_request_time = self.request_timestamps[-1]
                elapsed = now - last_request_time
                if elapsed < min_interval:
                    wait_time = min_interval - elapsed
                    logger.debug(f"Nvidia Rate Limit: Waiting {wait_time:.2f}s to maintain {rpm_limit} RPM")
                    await asyncio.sleep(wait_time)
                    now = asyncio.get_event_loop().time()

            self.request_timestamps.append(now)
            # Keep only the last request to calculate the minimum interval
            if len(self.request_timestamps) > 1:
                self.request_timestamps.popleft()

    async def chat_completions(self, payload: Dict[str, Any], stream: bool = False) -> Any:
        url = f"{self.base_url}/chat/completions"
        payload["stream"] = stream
        
        # Simple token estimation for automatic RPM
        token_estimate = 0
        for msg in payload.get("messages", []):
            token_estimate += len(str(msg.get("content", ""))) // 4
        
        if stream:
            await self._apply_rate_limit(token_estimate)
            return self._stream_request(url, payload)
        
        # Remove internal retry_handler to avoid double-retry
        # Retry is now managed exclusively by the NvidiaAdapter
        return await self._post_request(url, payload, token_estimate)

    async def _post_request(self, url, payload, token_estimate=1000):
        await self._apply_rate_limit(token_estimate)
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
        await self._apply_rate_limit()
        response = await self.client.get(f"{self.base_url}/{endpoint}", headers=self.headers)
        response.raise_for_status()
        return response.json()

    async def close(self):
        await self.client.aclose()
