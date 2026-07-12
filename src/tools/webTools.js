import { execFile } from "child_process";
import { promisify } from "util";
import axios from "axios";
import fs from "fs/promises";
import path from "path";

const ROOT_DIR = process.cwd();

const CHUNK_SIZE = 10000; // 10KB limit for initial context window

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
  
  #fetchBuffer = { url: null, data: null };

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
        ["-dump", "-no-numbering", normalizedUrl],
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
   * Fetches a URL and returns raw HTML/text, utilizing an in-memory buffer.
   * If the URL is already in the buffer, it skips the HTTP request.
   * @param {string} url - The URL to fetch.
   * @param {string} [searchQuery] - Optional exact string to search for in the full content.
   * @param {string | object} [customHeaders] - Custom HTTP headers.
   * @returns {Promise<string>} The first chunk of content, or matching windows if searchQuery is provided.
   */
  async fetchRaw(url, searchQuery, customHeaders = "{}") {
    const normalizedUrl = this.#normalizeUrl(url);

    if (this.#fetchBuffer.url !== normalizedUrl) {
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

      this.#fetchBuffer = { url: normalizedUrl, data: response.data };
    }

    const { data } = this.#fetchBuffer;

    if (searchQuery) {
      const WINDOW = 500;
      const safeQuery = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(`[\\s\\S]{0,${WINDOW}}${safeQuery}[\\s\\S]{0,${WINDOW}}`, "gi");
      const matches = data.match(regex);
      return matches && matches.length > 0
        ? matches.join("\n---\n")
        : "No matches found.";
    }

    return data.length > CHUNK_SIZE
      ? `${data.substring(0, CHUNK_SIZE)}\n\n[TRUNCATED: Content exceeds context limit. Use 'searchQuery' to access the remaining content.]`
      : data;
  }
}
