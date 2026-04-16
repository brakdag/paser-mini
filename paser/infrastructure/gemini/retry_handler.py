import time
import logging
from typing import Callable, Any, TypeVar
from . import errors

logger = logging.getLogger(__name__)
T = TypeVar('T')

class RetryHandler:
    def __init__(self, max_retries: int = 5, default_delay: float = 5.0):
        self.max_retries = max_retries
        self.default_delay = default_delay

    def execute(self, func: Callable[..., T], *args, **kwargs) -> T:
        retries = 0
        while True:
            try:
                return func(*args, **kwargs)
            except Exception as e:
                if not errors.is_retryable_error(e) or retries >= self.max_retries:
                    if retries >= self.max_retries:
                        formatted_error = errors.format_api_error(e, lambda err, ret: errors.get_retry_delay(err, ret, self.default_delay))
                        logger.error(f"API Error: Max retries reached. {formatted_error}")
                        # We raise the exception to let the adapter decide how to return it
                        raise e
                    raise e
                
                delay = errors.get_retry_delay(e, retries, self.default_delay)
                logger.warning(f"API Retry {retries + 1}/{self.max_retries} in {delay}s due to: {e}")
                time.sleep(delay)
                retries += 1
