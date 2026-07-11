import { execFile } from "child_process";
import { promisify } from "util";
import axios from "axios";
import fs from "fs/promises";
import path from "path";

const ROOT_DIR = process.cwd();
const FETCH_SIZE_LIMIT = 100 * 1024; // 100KB limit, matching read tool standards

/**
 * Tools for web interaction, searching, and rendering pages to text.
 */
export default class WebTools {
  #BROWSER_HEADERS = {
    "User-Agent":
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    Connection: "keep-alive",
    "Upgrade-Insecure-Requests": "1",
    Referer: "https://duckduckgo.com/",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "same-origin",
    "Sec-Fetch-User": "?1",
  };

  #execFilePromise = promisify(execFile);

  /**
   * Normalizes a URL by ensuring it has a protocol.
   * @param {string} url - The URL to normalize.
   * @returns {string} The normalized URL.
   */
  #normalizeUrl(url) {
    if (!url) return url;
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      return `https://${url}`;
    }
    return url;
  }

  /**
   * Reads fetch headers from config.json.
   * @returns {Promise<object>} The fetch headers.
   */
  async #getFetchHeaders() {
    try {
      const configPath = path.resolve(ROOT_DIR, "config/config.json");
      const config = JSON.parse(await fs.readFile(configPath, "utf8"));
      return config.fetch_headers || {};
    } catch {
      return {};
    }
  }

  /**
   * Searches the web using multiple providers.
   * @param {string} query - The search query.
   * @returns {Promise<string>} The search results as text.
   * @throws {Error} If all search methods fail.
   */
  async searchWeb(query) {
    const encodedQuery = encodeURIComponent(query);
    const searchUrls = [
      `https://lite.duckduckgo.com/lite/?q=${encodedQuery}`,
      `https://search.brave.com/search?q=${encodedQuery}`,
    ];

    for (let i = 0; i < searchUrls.length; i += 1) {
      const url = searchUrls[i];
      try {
        const { stdout } = await this.#execFilePromise(
          "elinks",
          ["-dump", "-no-numbering", url],
          {
            timeout: 20000,
          },
        );

        if (
          !stdout.includes("captcha") &&
          !stdout.includes("anomaly-modal") &&
          !stdout.includes("Robot Check") &&
          stdout.trim() !== ""
        ) {
          return stdout;
        }
      } catch (error) {
        // Silently fail and try next provider to ensure maximum availability
      }
    }

    throw new Error("All search methods failed or returned empty results.");
  }

  /**
   * Renders a web page to text using elinks.
   * @param {string} url - The URL to render.
   * @returns {Promise<string>} The rendered content.
   * @throws {Error} If the rendering process fails.
   */
  async renderWeb(url) {
    const normalizedUrl = this.#normalizeUrl(url);
    try {
      const { stdout } = await this.#execFilePromise(
        "elinks",
        ["-dump", normalizedUrl],
        {
          timeout: 30000,
        },
      );
      return stdout;
    } catch (e) {
      throw new Error(`Rendering failed: ${e.message}`);
    }
  }

  /**
   * Fetches a URL and returns the raw HTML/text.
   * Uses fetch_headers from config.json if available.
   * @param {string} url - The URL to fetch.
   * @param {string | object} [customHeaders] - Custom HTTP headers (JSON string or object) to add or override defaults.
   * @returns {Promise<string>} The raw HTML/text content.
   * @throws {Error} If the fetch fails or if customHeaders is invalid JSON.
   */
  async fetchRaw(url, customHeaders = "{}") {
    const normalizedUrl = this.#normalizeUrl(url);
    let parsedHeaders = {};
    try {
      parsedHeaders =
        typeof customHeaders === "string"
          ? JSON.parse(customHeaders || "{}")
          : customHeaders;
    } catch {
      throw new Error("Invalid JSON format for headers.");
    }

    const configHeaders = await this.#getFetchHeaders();
    const response = await axios.get(normalizedUrl, {
      headers: { ...this.#BROWSER_HEADERS, ...configHeaders, ...parsedHeaders },
      timeout: 15000,
      responseType: "text",
    });

    const { data } = response;
    const size = Buffer.byteLength(data, "utf8");

    if (size > FETCH_SIZE_LIMIT) {
      const contentType = response.headers["content-type"] || "text/plain";
      let ext = "txt";
      if (contentType.includes("application/json")) ext = "json";
      else if (contentType.includes("text/html")) ext = "html";
      else if (
        contentType.includes("application/xml") ||
        contentType.includes("text/xml")
      )
        ext = "xml";

      const tempFileName = `fetch_tmp_${Date.now()}.${ext}`;
      const tempFilePath = path.resolve(ROOT_DIR, tempFileName);
      await fs.writeFile(tempFilePath, data, "utf8");
      return `Response size (${size} bytes) exceeds context limit. Content saved to: ${tempFileName}`;
    }

    return data;
  }
}
