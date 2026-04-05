import urllib.request
import urllib.parse
import re
import html2text
import logging
import json
from .util_tools import retry_request

logger = logging.getLogger("tools")

@retry_request
def _fetch_url(url: str):
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=10) as response:
        return response.read().decode('utf-8', errors='ignore')

def buscar_en_internet(query: str) -> str:
    encoded_query = urllib.parse.quote(query)
    url = f"https://lite.duckduckgo.com/lite/?q={encoded_query}"
    try:
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
    except Exception as e:
        logger.error(f"Error en buscar_en_internet: {e}")
        return f"Error: {e}"

def leer_url(url: str) -> str:
    try:
        html = _fetch_url(url)
        h = html2text.HTML2Text()
        h.ignore_links = True
        h.ignore_images = True
        return h.handle(html)[:3000]
    except Exception as e:
        logger.error(f"Error al leer la URL {url}: {e}")
        return f"Error al leer la URL: {e}"
