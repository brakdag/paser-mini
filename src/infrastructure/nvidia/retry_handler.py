import asyncio
import logging
import httpx
from typing import Optional, Callable

logger = logging.getLogger(__name__)

class NvidiaRetryHandler:
    def __init__(self, max_retries: int = 5, callback: Optional[Callable[[str], None]] = None):
        self.max_retries = max_retries
        self.callback = callback

    def set_callback(self, callback: Optional[Callable[[str], None]]):
        self.callback = callback

    async def execute(self, func, *args, **kwargs):
        retries = 0
        while True:
            try:
                return await func(*args, **kwargs)
            except httpx.HTTPStatusError as e:
                status_code = e.response.status_code
                if retries >= self.max_retries:
                    raise e
                
                if status_code == 429:
                    retry_after_header = e.response.headers.get("Retry-After")
                    delay = float(retry_after_header) if retry_after_header and retry_after_header.isdigit() else (2 ** retries)
                    msg = f"Rate limited (429). Retrying in {delay}s..."
                    logger.warning(msg)
                    if self.callback:
                        self.callback(msg)
                elif status_code in [500, 502, 503, 504]:
                    delay = 2 ** retries
                    msg = f"Server error ({status_code}). Retrying in {delay}s..."
                    logger.warning(msg)
                    if self.callback:
                        self.callback(msg)
                elif status_code == 404:
                    logger.error("Modelo no encontrado (404). Deteniendo ejecución.")
                    raise e
                else:
                    raise e
                
                await asyncio.sleep(delay)
                retries += 1
            except Exception as e:
                if retries < self.max_retries:
                    delay = 2 ** retries
                    msg = f"Network/Unexpected error {e}. Retrying in {delay}s..."
                    logger.warning(msg)
                    if self.callback:
                        self.callback(msg)
                    await asyncio.sleep(delay)
                    retries += 1
                else:
                    raise e
