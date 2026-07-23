import { execFile } from "child_process";
import { promisify } from "util";
import axios from "axios";
import fs from "fs/promises";
import path from "path";

const ROOT_DIR = process.cwd();

const CHUNK_SIZE = 10000;
const SEARCH_TIMEOUT_MS = 20000;
const FETCH_TIMEOUT_MS = 15000;
const RENDER_TIMEOUT_MS = 30000;
const MAX_PDF_BUFFER = 10 * 1024 * 1024;

const LF = String.fromCharCode(10);

/**
 * Tools for web interaction, searching, and rendering pages to text.
 */
export default class WebTools {
  #BROWSER_HEADERS = {
    "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3",
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
   * Filters out boilerplate text from DuckDuckGo search results.
   * Extracts only the meaningful content between the pagination links.
   * @param {string} stdout - The raw output from elinks.
   * @param {string} url - The URL that was searched.
   * @returns {string} The filtered text, or the original text if the pattern is not found.
   */
  #filterDuckDuckGoResults(stdout, url) {
    if (!url.includes("duckduckgo.com")) {
      return stdout;
    }

    const keyword = "Next Page >";
    const firstIndex = stdout.indexOf(keyword);
    const lastIndex = stdout.lastIndexOf(keyword);

    if (firstIndex !== -1 && lastIndex !== -1 && firstIndex !== lastIndex) {
      const closingBracketFirst = stdout.indexOf("]", firstIndex);
      const openingBracketLast = stdout.lastIndexOf("[", lastIndex);

      if (closingBracketFirst !== -1 && openingBracketLast !== -1 && closingBracketFirst < openingBracketLast) {
        return stdout.substring(closingBracketFirst + 1, openingBracketLast).trim();
      }
    }

    return stdout;
  }

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
      const configPath = path.resolve(ROOT_DIR, ".paser-mini/config/config.json");
      const config = JSON.parse(await fs.readFile(configPath, "utf8"));
      return config.fetch_headers || {};
    } catch {
      return {};
    }
  }

  /**
   * Fetches the first page of DuckDuckGo search results.
   * @param {string} encodedQuery - The URL-encoded search query.
   * @returns {Promise<string>} The filtered text of the first page.
   * @throws {Error} If the fetch fails or is blocked.
   */
  async #fetchDuckDuckGoPage(encodedQuery) {
    const url = `https://lite.duckduckgo.com/lite/?q=${encodedQuery}`;
    const { stdout } = await this.#execFilePromise(
      "elinks",
      ["-dump", "-no-numbering", "-no-references", "-force-html", url],
      { timeout: SEARCH_TIMEOUT_MS }
    );

    if (
      stdout.includes("captcha") ||
      stdout.includes("anomaly-modal") ||
      stdout.includes("Robot Check") ||
      stdout.trim() === ""
    ) {
      throw new Error("DuckDuckGo page fetch failed or blocked.");
    }

    return this.#filterDuckDuckGoResults(stdout, url);
  }

  /**
   * Searches the web using multiple providers.
   * @param {string} query - The search query.
   * @returns {Promise<string>} The search results as text.
   * @throws {Error} If all search methods fail.
   */
  async searchWeb(query) {
    const encodedQuery = encodeURIComponent(query);

    try {
      const raw = await this.#fetchDuckDuckGoPage(encodedQuery);
      if (raw && raw.trim() !== "") {
        return raw;
      }
    } catch {
      // Silently fail and try next provider
    }

    const braveUrl = `https://search.brave.com/search?q=${encodedQuery}`;
    try {
      const { stdout } = await this.#execFilePromise(
        "elinks",
        ["-dump", "-no-numbering", "-no-references", "-force-html", braveUrl],
        { timeout: SEARCH_TIMEOUT_MS }
      );

      if (
        !stdout.includes("captcha") &&
        !stdout.includes("anomaly-modal") &&
        !stdout.includes("Robot Check") &&
        stdout.trim() !== ""
      ) {
        return stdout;
      }
    } catch {
      // Silently fail
    }

    throw new Error("All search methods failed or returned empty results.");
  }

  /**
   * Renders a web page or document to text.
   * Detects if the content is a PDF and uses pdftotext, otherwise uses elinks for HTML.
   * @param {string} url - The URL to render.
   * @returns {Promise<string>} The rendered content.
   * @throws {Error} If the rendering process fails.
   */
  async renderWeb(url) {
    const normalizedUrl = this.#normalizeUrl(url);
    const requestHeaders = {
      ...this.#BROWSER_HEADERS,
      ...(await this.#getFetchHeaders()),
    };

    let response;
    try {
      response = await axios.get(normalizedUrl, {
        headers: requestHeaders,
        timeout: FETCH_TIMEOUT_MS,
        responseType: "arraybuffer",
      });
    } catch (e) {
      throw new Error(`Fetch failed: ${e.message}`);
    }

    const contentType = response.headers["content-type"] || "";
    const bufferData = Buffer.from(response.data);

    const isPdf =
      contentType.includes("application/pdf") ||
      bufferData.slice(0, 4).toString("latin1") === "%PDF";

    if (isPdf) {
      const tempPath = path.join(ROOT_DIR, `temp_${Date.now()}.pdf`);
      try {
        await fs.writeFile(tempPath, bufferData);
        const { stdout } = await this.#execFilePromise(
          "pdftotext",
          ["-layout", "-htmlmeta", tempPath, "-"],
          { timeout: RENDER_TIMEOUT_MS, maxBuffer: MAX_PDF_BUFFER }
        );
        return stdout;
      } catch (e) {
        throw new Error(`PDF conversion failed: ${e.message}`);
      } finally {
        await fs.unlink(tempPath).catch(() => {});
      }
    }

    try {
      const { stdout } = await this.#execFilePromise(
        "elinks",
        ["-dump", "-force-html", normalizedUrl],
        { timeout: RENDER_TIMEOUT_MS }
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
        headers: {
          ...this.#BROWSER_HEADERS,
          ...configHeaders,
          ...parsedHeaders,
        },
        timeout: FETCH_TIMEOUT_MS,
        responseType: "text",
      });

      this.#fetchBuffer = { url: normalizedUrl, data: response.data };
    }

    const { data } = this.#fetchBuffer;

    if (searchQuery) {
      const SEARCH_WINDOW_CHARS = 500;
      const MAX_MATCHES_PER_QUERY = 3;
      const MAX_TOTAL_LENGTH = 10000;
      const queries = searchQuery.split(/s+/).filter(Boolean);
      const allMatches = [];

      queries.forEach((q) => {
        let idx = data.indexOf(q);
        let count = 0;
        while (idx !== -1 && count < MAX_MATCHES_PER_QUERY) {
          const start = Math.max(0, idx - SEARCH_WINDOW_CHARS);
          const end = Math.min(data.length, idx + q.length + SEARCH_WINDOW_CHARS);
          allMatches.push(data.substring(start, end));
          count += 1;
          idx = data.indexOf(q, idx + 1);
        }
      });

      if (allMatches.length === 0) {
        return "No matches found.";
      }

      let result = allMatches.join(`${LF}---${LF}`);
      if (result.length > MAX_TOTAL_LENGTH) {
        result = result.substring(0, MAX_TOTAL_LENGTH);
        result += `${LF}${LF}[TRUNCATED: Too many matches. Refine your search query.]`;
      }

      return result;
    }
    
    if (data.length > CHUNK_SIZE) {
      return `${data.substring(0, CHUNK_SIZE)}${LF}${LF}[TRUNCATED: Content exceeds context limit. Use 'searchQuery' to access the remaining content.]`;
    }
    
    return data;
  }
}
