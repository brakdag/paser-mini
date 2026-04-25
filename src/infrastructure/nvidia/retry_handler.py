import time
import logging
import httpx

logger = logging.getLogger(__name__)

class NvidiaRetryHandler:
    def __init__(self, max_retries: int = 5):
        self.max_retries = max_retries

    def execute(self, func, *args, **kwargs):
        retries = 0
        while True:
            try:
                return func(*args, **kwargs)
            except httpx.HTTPStatusError as e:
                if e.response.status_code == 429 and retries < self.max_retries:
                    retry_after_header = e.response.headers.get("Retry-After")
                    retry_after = float(retry_after_header) if retry_after_header and retry_after_header.isdigit() else (2 ** retries)
                    print(f"Error 429 NVIDIA {retry_after}s")
                    logger.warning(f"Rate limited (429). Retrying in {retry_after}s...")
                    time.sleep(retry_after)
                    retries += 1
                    continue
                raise e
            except Exception as e:
                if retries < self.max_retries:
                    delay = 2 ** retries
                    logger.warning(f"Error {e}. Retrying in {delay}s...")
                    time.sleep(delay)
                    retries += 1
                    continue
                raise e