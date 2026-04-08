import datetime
import time
import ast
import operator
import logging

logger = logging.getLogger("tools")

def retry_request(func):
    def wrapper(*args, **kwargs):
        max_retries = 3
        backoff_factor = 1
        for i in range(max_retries):
            try:
                return func(*args, **kwargs)
            except Exception as e:
                if i == max_retries - 1:
                    raise e
                sleep_time = backoff_factor * (2 ** i)
                logger.warning(f"Error in {func.__name__}, retrying in {sleep_time} seconds. Attempt {i+1}/{max_retries}. Error: {e}")
                time.sleep(sleep_time)
    return wrapper

def get_time(zona_horaria: str) -> str:
    now_utc = datetime.datetime.now(datetime.timezone.utc)
    return f"La hora actual en {zona_horaria} (simulado UTC) es: {now_utc.strftime('%H:%M:%S')}"

def get_cwd() -> str:
    import os
    return os.getcwd()

