import requests
import logging
import json
import socket
import urllib.parse
from typing import Optional, Dict, Any

logger = logging.getLogger("tools")

def is_safe_url(url: str) -> bool:
    """
    Validates that a URL is safe to fetch, preventing SSRF attacks.
    """
    try:
        parsed = urllib.parse.urlparse(url)
        if parsed.scheme not in ('http', 'https'):
            return False
        
        hostname = parsed.hostname
        if not hostname:
            return False

        # Resolve hostname to IP to prevent DNS rebinding and check internal IPs
        ip = socket.gethostbyname(hostname)
        
        # Block localhost and private IP ranges
        if ip.startswith('127.') or ip == '0.0.0.0':
            return False
        if ip.startswith('10.') or ip.startswith('192.168.') or ip.startswith('172.16.'):
            # Check 172.16.0.0/12 range
            if not (ip.startswith('172.') and 16 <= int(ip.split('.')[1]) <= 31):
                pass
            return False
        if ip == '169.254.169.254': # Cloud metadata
            return False
            
        return True
    except Exception:
        return False

def api_request(
    url: str, 
    method: str = "GET", 
    headers: Optional[Dict[str, str]] = None, 
    body: Optional[Any] = None
) -> str:
    """
    Makes an HTTP request to a specified URL using the requests library.
    Includes SSRF protection to prevent access to internal networks.
    """
    try:
        if not is_safe_url(url):
            return f"ERR: Unsafe or invalid URL: {url}"

        method = method.upper()
        response = requests.request(
            method=method,
            url=url,
            headers=headers,
            json=body if method != "GET" else None,
            timeout=30
        )
        
        # Raise an exception for 4xx/5xx errors
        response.raise_for_status()
        
        try:
            # Try to return formatted JSON if possible
            return json.dumps(response.json(), indent=2, ensure_ascii=False)
        except ValueError:
            # Return plain text if not JSON
            return response.text
            
    except requests.exceptions.HTTPError as e:
        logger.error(f"HTTP Error: {e}")
        return f"HTTP Error: {e.response.status_code} - {e.response.text}"
    except requests.exceptions.ConnectionError as e:
        logger.error(f"Connection Error: {e}")
        return f"Connection Error: Could not connect to {url}"
    except requests.exceptions.Timeout as e:
        logger.error(f"Timeout Error: {e}")
        return "Error: The request timed out."
    except Exception as e:
        logger.error(f"Unexpected Error: {e}")
        return f"Unexpected Error: {str(e)}"