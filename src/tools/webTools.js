import { execSync } from "child_process";
import axios from "axios";

export class WebTools {
  #BROWSER_HEADERS = {
    "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive",
    "Upgrade-Insecure-Requests": "1",
    "Referer": "https://duckduckgo.com/",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "same-origin",
    "Sec-Fetch-User": "?1",
  };

  async searchWeb({ query }) {
    const encodedQuery = encodeURIComponent(query);
    const searchUrls = [
      `https://lite.duckduckgo.com/lite/?q=${encodedQuery}`,
      `https://search.brave.com/search?q=${encodedQuery}`,
    ];

    for (const url of searchUrls) {
      try {
        const response = await axios.get(url, {
          headers: this.#BROWSER_HEADERS,
          timeout: 10000,
        });

        const data = response.data;
        if (!data.includes("captcha") && !data.includes("anomaly-modal") && !data.includes("Robot Check")) {
          return data;
        }
      } catch (e) {
        // Silently fail and try next provider
      }
    }

    // Final fallback: Use elinks for the primary search engine
    try {
      return execSync(`elinks -dump ${searchUrls[0]}`, { encoding: "utf8", timeout: 20000 });
    } catch (e) {
      return `ERR: All search methods failed: ${e.message}`;
    }
  }

  async renderWeb({ url }) {
    try {
      const output = execSync(`elinks -dump ${url}`, { encoding: "utf8", timeout: 30000 });
      return output;
    } catch (e) {
      return `ERR: Rendering failed: ${e.message}`;
    }
  }
}
