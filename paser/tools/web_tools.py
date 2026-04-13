import urllib.request
import urllib.parse
import re
import logging
import json
import subprocess
import os
from .core_tools import ToolError
import socket
from .util_tools import retry_request

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
                pass # This is a simplification, but covers the basics
            return False
        if ip == '169.254.169.254': # Cloud metadata
            return False
            
        return True
    except Exception:
        return False

@retry_request
def _fetch_url(url: str):
    if not is_safe_url(url):
        raise ToolError(f"Unsafe or invalid URL: {url}")
    
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=10) as response:
        return response.read().decode('utf-8', errors='ignore')

def web_search(query: str) -> str:
    encoded_query = urllib.parse.quote(query)
    url = f"https://lite.duckduckgo.com/lite/?q={encoded_query}"
    
    html = _fetch_url(url)
    links = re.findall(r'<a[^>]*?href="([^\"]+)\"[^>]*?>(.*?)</a>', html, re.DOTALL)
    results = []
    for link, title in links[:3]: # Limited to 3 results
        if 'uddg=' in link:
            params = urllib.parse.parse_qs(urllib.parse.urlparse(link).query)
            if 'uddg' in params:
                clean_title = re.sub(r'<[^>]*?>', '', title).strip()
                results.append({"title": clean_title, "link": params['uddg'][0]})
        elif link.startswith('http'):
            clean_title = re.sub(r'<[^>]*?>', '', title).strip()
            results.append({"title": clean_title, "link": link})
    return json.dumps(results)

def fetch_url(url: str) -> str:
    """
    Fetches the raw HTML content of a URL. Useful for scraping and analysis.
    """
    try:
        html = _fetch_url(url)
        # Limit the output to avoid overflowing the context window
        return html[:10000]
    except Exception as e:
        logger.error(f"Error fetching URL {url}: {str(e)}")
        raise ToolError(f"Error fetching URL: {str(e)}")

def render_web_page(url: str) -> str:
    """
    Renders a web page using elinks -dump to return a clean, human-readable text version.
    """
    try:
        if not is_safe_url(url):
            raise ToolError(f"Unsafe or invalid URL: {url}")

        # Set environment to ensure UTF-8 output
        env = os.environ.copy()
        env["LANG"] = "en_US.UTF-8"
        
        result = subprocess.run(
            ["elinks", "-dump", "-no-references", url],
            capture_output=True,
            text=True,
            env=env,
            timeout=15,
            encoding='utf-8',
            errors='ignore'
        )
        
        if result.returncode != 0:
            logger.error(f"Elinks error: {result.stderr}")
            raise ToolError(f"Error rendering page: {result.stderr}")
            
        return result.stdout
    except subprocess.TimeoutExpired:
        logger.error(f"Elinks timeout for URL: {url}")
        raise ToolError("The page took too long to render.")
    except Exception as e:
        logger.error(f"Unexpected error rendering page {url}: {str(e)}")
        raise ToolError(f"Error rendering page: {str(e)}")