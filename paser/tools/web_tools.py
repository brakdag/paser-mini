import urllib.request
import urllib.parse
import re
import html2text
import logging
import json
import subprocess
import os
from .util_tools import retry_request

logger = logging.getLogger("tools")

@retry_request
def _fetch_url(url: str):
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
    html = _fetch_url(url)
    h = html2text.HTML2Text()
    h.ignore_links = True
    h.ignore_images = True
    return h.handle(html)[:3000]

def render_web_page(url: str) -> str:
    """
    Renders a web page using elinks -dump to return a clean, human-readable text version.
    """
    try:
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
            return f"Error rendering page: {result.stderr}"
            
        return result.stdout
    except subprocess.TimeoutExpired:
        logger.error(f"Elinks timeout for URL: {url}")
        return "Error: The page took too long to render."
    except Exception as e:
        logger.error(f"Unexpected error rendering page {url}: {str(e)}")
        return f"Error rendering page: {str(e)}"