import { execFile } from "child_process";
import { promisify } from "util";
import axios from "axios";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { randomUUID } from "crypto";
import ConfigManager from "../core/configManager.js";

const CHUNK_SIZE = 10000;
const SEARCH_TIMEOUT_MS = 20000;
const FETCH_TIMEOUT_MS = 15000;
const RENDER_TIMEOUT_MS = 30000;
const MAX_PDF_BUFFER = 10 * 1024 * 1024;
const DEFAULT_CACHE_TTL_MS = 60 * 1000;
const MAX_FETCH_BUFFER = 10 * 1024 * 1024;

const LF = String.fromCharCode(10);

/**
 * Parses caller supplied headers.
 * @param {string | object} headers - JSON text or header map.
 * @returns {object} Parsed header map.
 */
function parseHeaders(headers) {
  const parsed = typeof headers === "string" ? JSON.parse(headers || "{}") : headers;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Headers must be a JSON object.");
  }
  return parsed;
}

/**
 * Merges header sets case-insensitively, with later sets taking precedence.
 * @param {...object} headerSets - Header maps in precedence order.
 * @returns {object} Merged header map.
 */
function mergeHeaders(...headerSets) {
  const normalized = new Map();
  headerSets.forEach((headers) => {
    Object.entries(headers || {}).forEach(([name, value]) => {
      const key = name.toLowerCase();
      const previous = normalized.get(key);
      normalized.set(key, { name: previous?.name || name, value: String(value) });
    });
  });
  return Object.fromEntries([...normalized.values()].map(({ name, value }) => [name, value]));
}

/**
 * Creates a stable, case-insensitive cache identity for request headers.
 * @param {object} headers - Effective request headers.
 * @returns {Array<Array<string>>} Sorted normalized header pairs.
 */
function cacheHeaderIdentity(headers) {
  return Object.entries(headers)
    .map(([name, value]) => [name.toLowerCase(), String(value)])
    .sort(([left], [right]) => left.localeCompare(right));
}

/**
 * Returns the byte size of a supported response body.
 * @param {unknown} data - Response body.
 * @returns {number} Size in bytes.
 */
function getDataSize(data) {
  if (Buffer.isBuffer(data)) return data.byteLength;
  if (typeof data === "string") return Buffer.byteLength(data);
  if (data instanceof ArrayBuffer) return data.byteLength;
  if (ArrayBuffer.isView(data)) return data.byteLength;
  return Buffer.byteLength(JSON.stringify(data));
}

/**
 * Checks whether a response content type represents text or structured text.
 * @param {string} contentType - Response content type.
 * @returns {boolean} Whether the body can be consumed as text.
 */
function isTextContentType(contentType) {
  const type = contentType.split(";")[0].trim().toLowerCase();
  return type.startsWith("text/") || type === "application/json" || type.endsWith("+json") ||
    type === "application/xml" || type.endsWith("+xml");
}

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

  #execFilePromise;

  #httpClient;

  #configManager;

  #tempDir;

  #fetchTimeoutMs;

  #renderTimeoutMs;

  #maxDownloadBytes;

  #cacheTtlMs;

  #now;

  #fetchBuffer = null;

  /**
   * @param {object} [options] Optional dependencies and resource limits.
   * @param {object|null} [options.configManager] ConfigManager-compatible instance; created lazily by default.
   * @param {object} [options.httpClient] Axios-compatible client.
   * @param {(command: string, args: string[], options: object) => Promise<{stdout: string}>} [options.executor] Promise-returning execFile-compatible function.
   * @param {string} [options.tempDir] Directory for exclusive PDF temporary files.
   * @param {number} [options.fetchTimeoutMs] HTTP request timeout in milliseconds.
   * @param {number} [options.renderTimeoutMs] Renderer subprocess timeout in milliseconds.
   * @param {number} [options.maxDownloadBytes] Maximum HTTP response size in bytes.
   * @param {number} [options.cacheTtlMs] Raw fetch cache lifetime in milliseconds.
   * @param {() => number} [options.now] Clock source for cache expiration.
   */
  constructor(options = {}) {
    this.#httpClient = options.httpClient || axios;
    this.#execFilePromise = options.executor || promisify(execFile);
    this.#configManager = options.configManager;
    this.#tempDir = options.tempDir || os.tmpdir();
    this.#fetchTimeoutMs = options.fetchTimeoutMs ?? FETCH_TIMEOUT_MS;
    this.#renderTimeoutMs = options.renderTimeoutMs ?? RENDER_TIMEOUT_MS;
    this.#maxDownloadBytes = options.maxDownloadBytes ?? MAX_FETCH_BUFFER;
    this.#cacheTtlMs = options.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;
    this.#now = options.now || Date.now;
  }

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
   * Reads layered fetch headers. Global values are the fallback; local values override them.
   * @returns {object} The merged configured headers.
   */
  #getFetchHeaders() {
    if (!this.#configManager) this.#configManager = new ConfigManager();
    const manager = this.#configManager;
    // Real storage resolves global precedence and legacy local fallback itself.
    if (manager instanceof ConfigManager) return manager.get("fetch_headers", {}) || {};
    let globalHeaders = {};
    let localHeaders = {};
    if (typeof manager.get === "function") {
      globalHeaders = manager.get("fetch_headers", {}) || {};
    } else {
      globalHeaders = manager.globalConfig?.fetch_headers || {};
    }
    // Injected managers can provide separate global and local header layers.
    localHeaders = manager.localConfig?.fetch_headers || {};
    return mergeHeaders(globalHeaders, localHeaders);
  }

  /**
   * Fetches the first page of DuckDuckGo search results.
   * @param {string} encodedQuery - The URL-encoded search query.
   * @returns {Promise<string>} The filtered text of the first page.
   * @throws {Error} If the fetch fails or is blocked.
   */
  async #fetchDuckDuckGoPage(encodedQuery) {
    const url = `https://lite.duckduckgo.com/lite/?q=${encodedQuery}&kl=us-en`;
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
    const requestHeaders = mergeHeaders(this.#BROWSER_HEADERS, this.#getFetchHeaders());

    let response;
    try {
      response = await this.#httpClient.get(normalizedUrl, {
        headers: requestHeaders,
        timeout: this.#fetchTimeoutMs,
        responseType: "arraybuffer",
        maxContentLength: this.#maxDownloadBytes,
        maxBodyLength: this.#maxDownloadBytes,
      });
    } catch (e) {
      throw new Error(`Fetch failed: ${e.message}`);
    }

    const contentType = response.headers["content-type"] || "";
    const bufferData = Buffer.from(response.data);
    if (bufferData.byteLength > this.#maxDownloadBytes) {
      throw new Error(`Fetch failed: response exceeds ${this.#maxDownloadBytes} bytes.`);
    }

    const isPdf =
      contentType.includes("application/pdf") ||
      bufferData.slice(0, 4).toString("latin1") === "%PDF";

    if (isPdf) {
      const tempPath = path.join(this.#tempDir, `paser-web-${randomUUID()}.pdf`);
      let fileCreated = false;
      try {
        const file = await fs.open(tempPath, "wx", 0o600);
        fileCreated = true;
        try {
          await file.writeFile(bufferData);
        } finally {
          await file.close();
        }
        const { stdout } = await this.#execFilePromise(
          "pdftotext",
          ["-layout", "-htmlmeta", tempPath, "-"],
          { timeout: this.#renderTimeoutMs, maxBuffer: MAX_PDF_BUFFER }
        );
        return stdout;
      } catch (e) {
        throw new Error(`PDF conversion failed: ${e.message}`);
      } finally {
        if (fileCreated) await fs.unlink(tempPath).catch(() => {});
      }
    }

    if (!isTextContentType(contentType)) {
      throw new Error(`Unsupported response content type: ${contentType || "unknown"}.`);
    }

    const tempPath = path.join(this.#tempDir, `paser-web-${randomUUID()}.html`);
    let fileCreated = false;
    try {
      const file = await fs.open(tempPath, "wx", 0o600);
      fileCreated = true;
      try {
        await file.writeFile(bufferData);
      } finally {
        await file.close();
      }
      const { stdout } = await this.#execFilePromise(
        "elinks",
        ["-dump", "-force-html", tempPath],
        { timeout: this.#renderTimeoutMs, maxBuffer: MAX_PDF_BUFFER }
      );
      return stdout;
    } catch (e) {
      throw new Error(`Rendering failed: ${e.message}`);
    } finally {
      if (fileCreated) await fs.unlink(tempPath).catch(() => {});
    }
  }

  /**
   * Fetches text or JSON content, using a bounded cache keyed by URL and effective headers.
   * @param {string} url - The URL to fetch.
   * @param {string} [searchQuery] - Optional literal phrase to search in the full content.
   * @param {string | object} [customHeaders] - Custom HTTP headers.
   * @param {{forceRefresh?: boolean, cacheTtlMs?: number}} [options] Cache controls.
   * @returns {Promise<string>} The first chunk, or matching windows around literal phrase occurrences.
   */
  async fetchRaw(url, searchQuery, customHeaders = "{}", options = {}) {
    const normalizedUrl = this.#normalizeUrl(url);
    let parsedHeaders;
    try {
      parsedHeaders = parseHeaders(customHeaders);
    } catch {
      throw new Error("Invalid JSON format for headers.");
    }

    const headers = mergeHeaders(this.#BROWSER_HEADERS, this.#getFetchHeaders(), parsedHeaders);
    const headerIdentity = cacheHeaderIdentity(headers);
    const ttl = options.cacheTtlMs ?? this.#cacheTtlMs;
    const now = this.#now();
    const isCacheValid = this.#fetchBuffer && this.#fetchBuffer.expiresAt > now;
    if (
      options.forceRefresh || !isCacheValid ||
      this.#fetchBuffer.url !== normalizedUrl ||
      JSON.stringify(this.#fetchBuffer.headers) !== JSON.stringify(headerIdentity)
    ) {
      const response = await this.#httpClient.get(normalizedUrl, {
        headers,
        timeout: this.#fetchTimeoutMs,
        responseType: "text",
        maxContentLength: this.#maxDownloadBytes,
        maxBodyLength: this.#maxDownloadBytes,
      });

      const contentType = response.headers?.["content-type"] || "";
      const contentLength = Number(response.headers?.["content-length"]);
      if (Number.isFinite(contentLength) && contentLength > this.#maxDownloadBytes) {
        throw new Error(`Fetch failed: response exceeds ${this.#maxDownloadBytes} bytes.`);
      }
      if (!isTextContentType(contentType)) {
        throw new Error(`Unsupported response content type: ${contentType || "unknown"}.`);
      }
      const { data: responseData } = response;
      let data = responseData;
      if (typeof data !== "string") {
        data = contentType.toLowerCase().includes("json") ? JSON.stringify(data) : null;
      }
      if (data === null) {
        throw new Error("Unsupported non-text response body.");
      }
      if (getDataSize(data) > this.#maxDownloadBytes) {
        throw new Error(`Fetch failed: response exceeds ${this.#maxDownloadBytes} bytes.`);
      }

      this.#fetchBuffer = {
        url: normalizedUrl,
        headers: headerIdentity,
        data,
        expiresAt: now + Math.max(0, ttl),
      };
    }

    const { data } = this.#fetchBuffer;

    if (searchQuery) {
      const SEARCH_WINDOW_CHARS = 500;
      const MAX_MATCHES_PER_QUERY = 3;
      const MAX_TOTAL_LENGTH = 10000;
      const allMatches = [];
      let idx = data.indexOf(searchQuery);
      while (idx !== -1 && allMatches.length < MAX_MATCHES_PER_QUERY) {
        const start = Math.max(0, idx - SEARCH_WINDOW_CHARS);
        const end = Math.min(data.length, idx + searchQuery.length + SEARCH_WINDOW_CHARS);
        allMatches.push(data.substring(start, end));
        idx = data.indexOf(searchQuery, idx + Math.max(1, searchQuery.length));
      }

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
