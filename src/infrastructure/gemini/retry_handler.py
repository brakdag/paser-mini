import asyncio
import logging
from typing import Callable, Any, TypeVar, Optional, Awaitable
from . import errors

logger = logging.getLogger(__name__)
T = TypeVar('T')

class RetryHandler:
    def __init__(self, max_retries: int = 5, default_delay: float = 5.0, on_retry: Optional[Callable[[str], None]] = None):
        self.max_retries = max_retries
        self.default_delay = default_delay
        self.on_retry = on_retry

    async def execute(self, func: Callable[..., Awaitable[T]], *args, **kwargs) -> T:
        retries = 0
        while True:
            try:
                # Await the async function
                return await func(*args, **kwargs)
            except Exception as e:
                if not errors.is_retryable_error(e) or retries >= self.max_retries:
                    if retries >= self.max_retries:
                        formatted_error = errors.format_api_error(e, lambda err, ret: errors.get_retry_delay(err, ret, self.default_delay))
                        logger.error(f"API Error: Max retries reached. {formatted_error}")
                        raise e
                    raise e
                
                delay = errors.get_retry_delay(e, retries, self.default_delay)
                # Notify UI via callback if available
                msg = f"API Retry {retries + 1}/{self.max_retries} in {delay}s due to: {e}"
                if self.on_retry:
                    self.on_retry(msg)
                else:
                    logger.warning(msg)
                
                # NON-BLOCKING sleep
                await asyncio.sleep(delay)
                retries += 1
