import { execSync } from "child_process";
import axios from "axios";

const BROWSER_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Accept-Encoding": "gzip, deflate, br",
  "Connection": "keep-alive",
  "Upgrade-Insecure-Requests": "1",
};

export async function searchWeb({ query }) {
  try {
    const response = await axios.get(`https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}`, {
      headers: BROWSER_HEADERS,
    });
    return response.data;
  } catch (e) {
    return `ERR: Search failed: ${e.message}`;
  }
}

export async function renderWeb({ url }) {
  try {
    // elinks -dump converts the page to a text representation
    const output = execSync(`elinks -dump ${url}`, { encoding: "utf8", timeout: 30000 });
    return output;
  } catch (e) {
    return `ERR: Rendering failed: ${e.message}`;
  }
}
