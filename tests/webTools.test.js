import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import WebTools from "../src/tools/webTools.js";
import ConfigManager from "../src/core/configManager.js";

let tempDir;

before(async () => {
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "paser-web-tools-test-"));
});

after(async () => {
  await fs.rm(tempDir, { recursive: true, force: true });
});

/**
 * Creates a minimal ConfigManager-compatible test double.
 * @param {object} [options] Global and local header maps.
 * @param {object} [options.globalHeaders] Global header map.
 * @param {object} [options.localHeaders] Local header map.
 * @returns {object} Configuration test double.
 */
function fakeConfigManager({ globalHeaders = {}, localHeaders = {} } = {}) {
  return {
    get(key, fallback) {
      return key === "fetch_headers" ? globalHeaders : fallback;
    },
    localConfig: { fetch_headers: localHeaders },
  };
}

/**
 * Creates an Axios-compatible fake and records requests.
 * @param {object} responseOrHandler Fixed response or request handler.
 * @returns {object} HTTP fake with a call log.
 */
function fakeHttp(responseOrHandler) {
  const calls = [];
  return {
    calls,
    async get(url, options) {
      calls.push({ url, options });
      return typeof responseOrHandler === "function"
        ? responseOrHandler(url, options, calls.length)
        : responseOrHandler;
    },
  };
}

describe("webTools.fetchRaw", () => {
  it("reads legacy headers without migration and preserves global precedence", async (t) => {
    const state = await fs.mkdtemp(path.join(os.tmpdir(), "paser-web-config-"));
    t.after(() => fs.rm(state, { recursive: true, force: true }));
    const globalDir = path.join(state, "global");
    const localDir = path.join(state, "local");
    await fs.mkdir(globalDir);
    await fs.mkdir(localDir);
    const localContent = JSON.stringify({ fetch_headers: { "X-Source": "legacy" } });
    await fs.writeFile(path.join(localDir, "config.json"), localContent);
    const legacy = new ConfigManager({ globalDir, localDir });
    const http = fakeHttp({ headers: { "content-type": "text/plain" }, data: "content" });
    await new WebTools({ httpClient: http, configManager: legacy }).fetchRaw("https://example.test/legacy");
    assert.equal(http.calls[0].options.headers["X-Source"], "legacy");
    await fs.writeFile(path.join(globalDir, "config.json"), JSON.stringify({ fetch_headers: { "X-Source": "global" } }));
    const global = new ConfigManager({ globalDir, localDir });
    await new WebTools({ httpClient: http, configManager: global }).fetchRaw("https://example.test/global");
    assert.equal(http.calls[1].options.headers["X-Source"], "global");
    assert.equal(await fs.readFile(path.join(localDir, "config.json"), "utf8"), localContent);
  });

  it("matches a literal phrase including s, spaces, and special characters", async () => {
    const phrase = "stress test + (a|b)?";
    const http = fakeHttp({
      headers: { "content-type": "text/plain; charset=utf-8" },
      data: `before stress testing. Exact: ${phrase}! after.`,
    });
    const tools = new WebTools({ httpClient: http, configManager: fakeConfigManager() });

    const result = await tools.fetchRaw("https://example.test/page", phrase);

    assert.equal(result, `before stress testing. Exact: ${phrase}! after.`);
    assert.equal(http.calls.length, 1);
    const stressMatches = await tools.fetchRaw("https://example.test/page", "stress");
    assert.equal(stressMatches.split("\n---\n").length, 2);
    assert.match(stressMatches, /stress testing/);
    assert.match(stressMatches, /stress test \+ \(a\|b\)\?/);
  });

  it("combines global, local, and per-call headers, and keys the cache by effective headers", async () => {
    const http = fakeHttp((_url, _options, callNumber) => ({
      headers: { "content-type": "text/plain" },
      data: `body-${callNumber}`,
    }));
    const tools = new WebTools({
      httpClient: http,
      configManager: fakeConfigManager({
        globalHeaders: { "X-Global": "global" },
        localHeaders: { "X-Local": "local", "X-Replace": "local" },
      }),
    });

    assert.equal(await tools.fetchRaw("example.test", undefined, { "X-Call": "one", "X-Replace": "call" }), "body-1");
    const sent = http.calls[0].options.headers;
    assert.equal(sent["X-Global"], "global");
    assert.equal(sent["X-Local"], "local");
    assert.equal(sent["X-Replace"], "call");
    assert.equal(sent["X-Call"], "one");
    assert.equal(await tools.fetchRaw("https://example.test", undefined, { "X-Call": "one", "X-Replace": "call" }), "body-1");
    assert.equal(await tools.fetchRaw("https://example.test", undefined, { "X-Call": "two", "X-Replace": "call" }), "body-2");
    assert.equal(http.calls.length, 2);
  });

  it("invalidates when configured global headers change and ignores header case/order", async () => {
    const globalHeaders = { "X-Token": "first" };
    const configManager = fakeConfigManager({ globalHeaders });
    const http = fakeHttp((_url, _options, callNumber) => ({
      headers: { "content-type": "text/plain" },
      data: `body-${callNumber}`,
    }));
    const tools = new WebTools({ httpClient: http, configManager });

    assert.equal(await tools.fetchRaw("https://example.test", undefined, { "X-A": "1", "X-B": "2" }), "body-1");
    assert.equal(await tools.fetchRaw("https://example.test", undefined, { "x-b": "2", "x-a": "1" }), "body-1");
    assert.equal(http.calls.length, 1);

    globalHeaders["X-Token"] = "second";
    assert.equal(await tools.fetchRaw("https://example.test", undefined, { "X-A": "1", "X-B": "2" }), "body-2");
    assert.equal(http.calls.length, 2);
    assert.equal(http.calls[1].options.headers["X-Token"], "second");
  });

  it("expires cached content and supports an explicit refresh", async () => {
    let now = 1000;
    const http = fakeHttp((_url, _options, callNumber) => ({
      headers: { "content-type": "text/plain" },
      data: `body-${callNumber}`,
    }));
    const tools = new WebTools({
      httpClient: http,
      configManager: fakeConfigManager(),
      cacheTtlMs: 10,
      /** @returns {number} Fixed test clock value. */
      now: () => now,
    });
    assert.equal(await tools.fetchRaw("https://example.test"), "body-1");
    now += 9;
    assert.equal(await tools.fetchRaw("https://example.test"), "body-1");
    assert.equal(await tools.fetchRaw("https://example.test", undefined, "{}", { forceRefresh: true }), "body-2");
    now += 11;
    assert.equal(await tools.fetchRaw("https://example.test"), "body-3");
    assert.equal(http.calls.length, 3);
  });

  it("accepts JSON text and rejects non-text bodies and oversized responses", async () => {
    const jsonHttp = fakeHttp({ headers: { "content-type": "application/json" }, data: { value: "ok" } });
    const jsonTools = new WebTools({ httpClient: jsonHttp, configManager: fakeConfigManager() });
    assert.equal(await jsonTools.fetchRaw("https://example.test/data"), '{"value":"ok"}');

    const binaryTools = new WebTools({
      httpClient: fakeHttp({ headers: { "content-type": "application/octet-stream" }, data: "\u0000\u0001" }),
      configManager: fakeConfigManager(),
    });
    await assert.rejects(binaryTools.fetchRaw("https://example.test/binary"), /Unsupported response content type/);

    const largeTools = new WebTools({
      httpClient: fakeHttp({ headers: { "content-type": "text/plain" }, data: "123456" }),
      configManager: fakeConfigManager(),
      maxDownloadBytes: 5,
    });
    await assert.rejects(largeTools.fetchRaw("https://example.test/large"), /exceeds 5 bytes/);
  });

  it("passes the configured timeout to HTTP and propagates timeout failures", async () => {
    const http = fakeHttp(async () => { throw new Error("timeout of 37ms exceeded"); });
    const tools = new WebTools({
      httpClient: http,
      configManager: fakeConfigManager(),
      fetchTimeoutMs: 37,
    });
    await assert.rejects(tools.fetchRaw("https://example.test/slow"), /timeout of 37ms exceeded/);
    assert.equal(http.calls[0].options.timeout, 37);
  });

  it("creates exclusive PDF temporaries and removes them after conversion", async () => {
    const http = fakeHttp({
      headers: { "content-type": "application/pdf" },
      data: Buffer.from("%PDF fixture"),
    });
    /**
     * Validates the PDF command's isolated temporary file and returns fixture text.
     * @param {string} command Executable name.
     * @param {string[]} args Command arguments.
     * @param {object} options Execution limits.
     * @returns {Promise<{stdout: string}>} Simulated output.
     */
    const executor = async (command, args, options) => {
      assert.equal(command, "pdftotext");
      assert.equal(options.timeout, 123);
      assert.equal((await fs.readFile(args[2])).toString(), "%PDF fixture");
      return { stdout: "converted pdf" };
    };
    const tools = new WebTools({
      httpClient: http,
      configManager: fakeConfigManager(),
      executor,
      tempDir,
      renderTimeoutMs: 123,
    });

    assert.equal(await tools.renderWeb("https://example.test/file.pdf"), "converted pdf");
    assert.deepEqual(await fs.readdir(tempDir), []);
  });

  it("renders fetched HTML from its bounded local temporary file", async () => {
    const http = fakeHttp({
      headers: { "content-type": "text/html; charset=utf-8" },
      data: Buffer.from("<html><body>fixture</body></html>"),
    });
    /**
     * Reads the local HTML fixture passed to the renderer.
     * @param {string} command Executable name.
     * @param {string[]} args Command arguments.
     * @returns {Promise<{stdout: string}>} Simulated output.
     */
    const executor = async (command, args) => {
      assert.equal(command, "elinks");
      assert.equal((await fs.readFile(args[2], "utf8")), "<html><body>fixture</body></html>");
      return { stdout: "fixture text" };
    };
    const tools = new WebTools({ httpClient: http, configManager: fakeConfigManager(), executor, tempDir });

    assert.equal(await tools.renderWeb("https://example.test/page"), "fixture text");
    assert.equal(http.calls.length, 1);
    assert.deepEqual(await fs.readdir(tempDir), []);
  });

  it("removes the exclusive PDF temporary when conversion fails", async () => {
    const http = fakeHttp({ headers: { "content-type": "application/pdf" }, data: Buffer.from("%PDF fixture") });
    /**
     * Checks that a PDF temporary exists before simulating converter failure.
     * @param {string} _command Executable name.
     * @param {string[]} args Command arguments.
     * @returns {Promise<never>} Rejected conversion.
     */
    const executor = async (_command, args) => {
      await fs.access(args[2]);
      throw new Error("fixture conversion failure");
    };
    const tools = new WebTools({ httpClient: http, configManager: fakeConfigManager(), executor, tempDir });

    await assert.rejects(tools.renderWeb("https://example.test/file.pdf"), /PDF conversion failed: fixture conversion failure/);
    assert.deepEqual(await fs.readdir(tempDir), []);
  });
});
