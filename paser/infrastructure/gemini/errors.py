import logging
import re
from typing import Optional
from google.genai.errors import ClientError

logger = logging.getLogger(__name__)

def is_retryable_error(e: Exception) -> bool:
    """Determina si un error es transitorio y amerita un reintento."""
    error_msg = str(e).lower()
    # Errores de cuota/TPM (429)
    if isinstance(e, ClientError) or getattr(e, 'status_code', None) == 429:
        return True
    if '429' in error_msg or 'quota' in error_msg or 'resource exhausted' in error_msg or 'tpm' in error_msg:
        return True
    # Errores de servidor (500, 503, 504)
    if getattr(e, 'status_code', None) in [500, 503, 504]:
        return True
    if any(code in error_msg for code in ['500', '503', '504']) or 'internal error' in error_msg or 'service unavailable' in error_msg:
        return True
    # Errores de red/conectividad
    if any(kw in error_msg for kw in ['connection', 'network', 'unreachable', 'timeout', 'dns', 'socket']):
        return True
    return False

def get_status_code(e: Exception) -> Optional[int]:
    """Extrae el código de estado de una excepción de la API."""
    if hasattr(e, 'status_code'):
        try:
            return int(e.status_code)
        except (ValueError, TypeError):
            pass
    # Intentar extraer de la cadena de error si es un JSON
    try:
        match = re.search(r'"status":\s*(\d+)', str(e))
        if match:
            return int(match.group(1))
    except Exception:
        pass
    return None

def get_retry_delay(error: Exception, retries: int, default_retry_delay: float) -> float:
    """Extrae el retryDelay del error o calcula un backoff exponencial."""
    error_msg = str(error)
    try:
        import json
        data = json.loads(error_msg)
        if isinstance(data, dict):
            stack = [data]
            while stack:
                curr = stack.pop()
                if isinstance(curr, dict):
                    if 'retryDelay' in curr:
                        val = curr['retryDelay']
                        return float(str(val).rstrip('s'))
                    stack.extend(curr.values())
                elif isinstance(curr, list):
                    stack.extend(curr)
    except Exception:
        pass

    try:
        match = re.search(r'"retryDelay":\s*"?(\d+)(?:s)?"?', error_msg)
        if match:
            return float(match.group(1))
    except Exception:
        pass

    return default_retry_delay * (2 ** retries)

def format_api_error(e: Exception, get_retry_delay_func) -> str:
    """Formatea el error de la API para que sea más amable e incluya el código de error."""
    error_msg = str(e).lower()
    status_code = get_status_code(e)
    code_str = f"({status_code}) " if status_code else ""
    
    if is_retryable_error(e) and (isinstance(e, ClientError) or getattr(e, 'status_code', None) == 429 or '429' in error_msg or 'quota' in error_msg):
        delay = get_retry_delay_func(e, 0)
        return f"{code_str}Cuota de API excedida. Por favor, espera {delay}s antes de intentar nuevamente."
    
    if any(kw in error_msg for kw in ['connection', 'network', 'unreachable', 'timeout', 'dns', 'socket']):
        return f"{code_str}Error de conectividad: No se pudo contactar con los servidores de Google."
        
    if any(code in error_msg for code in ['500', '503', 'internal error', 'unavailable']):
        return f"{code_str}El servidor de la API está experimentando problemas temporales. Reintentando..."
        
    return f"{code_str}{str(e)}"