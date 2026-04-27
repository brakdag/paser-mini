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
                status_code = e.response.status_code
                if retries >= self.max_retries:
                    raise e
                
                if status_code == 429:
                    retry_after_header = e.response.headers.get("Retry-After")
                    delay = float(retry_after_header) if retry_after_header and retry_after_header.isdigit() else (2 ** retries)
                    logger.warning(f"Rate limited (429). Retrying in {delay}s...")
                elif status_code in [500, 502, 503, 504]:
                    delay = 2 ** retries
                    logger.warning(f"Server error ({status_code}). Retrying in {delay}s...")
                else:
                    raise e
                
                time.sleep(delay)
                retries += 1
            except Exception as e:
                if retries < self.max_retries:
                    delay = 2 ** retries
                    logger.warning(f"Network/Unexpected error {e}. Retrying in {delay}s...")
                    time.sleep(delay)
                    retries += 1
                else:
                    raise e
