import logging
import re
from typing import Optional

logger = logging.getLogger(__name__)

def is_retryable_error(e: Exception) -> bool:
    error_msg = str(e).lower()
    status_code = getattr(e, 'status_code', None)
    if status_code in [429, 500, 503, 504]: return True
    if any(code in error_msg for code in ['429', '500', '503', '504']) or 'quota' in error_msg or 'resource exhausted' in error_msg:
        return True
    if any(kw in error_msg for kw in ['connection', 'network', 'timeout', 'socket']):
        return True
    return False

def get_status_code(e: Exception) -> Optional[int]:
    if hasattr(e, 'status_code'): return int(getattr(e, 'status_code'))
    match = re.search(r'"status":\s*(\d+)', str(e))
    return int(match.group(1)) if match else None

def get_retry_delay(error: Exception, retries: int, default_retry_delay: float) -> float:
    return default_retry_delay * (2 ** retries)

def format_api_error(e: Exception, get_retry_delay_func) -> str:
    error_msg = str(e).lower()
    status_code = get_status_code(e)
    code_str = f"({status_code}) " if status_code else ""
    if is_retryable_error(e): return f"{code_str}Error transitorio. Reintentando..."
    return f"{code_str}{str(e)}"