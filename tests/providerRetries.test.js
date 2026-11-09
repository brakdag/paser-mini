import { test } from "node:test";
import assert from "node:assert/strict";
import { AxiosError } from "axios";
import ApiCommunicator from "../src/core/ApiCommunicator.js";

const providers = ["gemini", "nvidia", "nvidia-minimax", "cohere", "zai", "groq", "cerebras", "cloudflare", "openrouter", "huggingface", "poolside", "zenmux"];
const data = {
  choices: [{ message: { content: "Answer" } }],
  candidates: [{ content: { parts: [{ text: "Answer" }] } }],
  message: { content: [{ text: "Answer" }] },
};

/**
 * Builds a provider with a fake Axios transport beneath all interceptors.
 * @param {string} provider - Module name.
 * @param {(config: object, count: number) => Promise<object>} transport - Simulated wire response.
 * @returns {Promise<object>} Adapter, communicator, clock and captured dispatches.
 */
async function fixture(provider, transport) {
  const { default: Adapter } = await import(`../src/infrastructure/${provider}/adapter.js`);
  const settings = { rpm_limit: 60000000 };
  const adapter = new Adapter({
    ui: { displayInfo() {}, displayError() {} },
    configManager: { get(key, fallback) { return settings[key] ?? fallback; } },
  });
  adapter.injectMessage("user", "Earlier context");
  adapter.injectMessage("assistant", "Earlier answer");
  const before = structuredClone(adapter.getHistory());
  const dispatches = [];
  const waits = [];
  let elapsed = 0;
  adapter.retryHandler.maxDelay = 0;
  /** @returns {number} Simulated monotonic time. */
  adapter.retryHandler.now = () => elapsed;
  /** @returns {number} Fixed time for HTTP date headers. */
  adapter.retryHandler.wallNow = () => Date.UTC(2026, 10, 9);
  /**
   * @param {number} ms - Scheduled delay.
   * @param {AbortSignal} signal - Request cancellation.
   * @returns {Promise<void>} Simulated completion.
   */
  adapter.retryHandler.sleep = async (ms, signal) => {
    signal.throwIfAborted();
    waits.push(ms);
    elapsed += ms;
  };
  const client = adapter.restClient?.client || adapter.client;
  /**
   * @param {object} config - Wire request.
   * @returns {Promise<object>} Simulated Axios response.
   */
  client.defaults.adapter = async config => {
    dispatches.push(config);
    const result = await transport(config, dispatches.length);
    return { data: result, status: 200, statusText: "OK", headers: {}, config };
  };
  const api = new ApiCommunicator(adapter, {});
  return { adapter, api, before, dispatches, waits, settings };
}

/**
 * Makes an HTTP or network failure with headers retained through Axios and provider wrappers.
 * @param {object} config - Axios request configuration.
 * @param {number|string} status - HTTP status or network code.
 * @param {object} [headers] - Server retry instructions.
 * @returns {AxiosError} Transport failure.
 */
function failure(config, status, headers = {}) {
  const response = typeof status === "number"
    ? { status, statusText: "Unavailable", data: {}, headers, config }
    : undefined;
  return new AxiosError("Simulated failure", typeof status === "string" ? status : undefined, config, undefined, response);
}

providers.forEach(provider => {
  [429, 503, "ECONNRESET", 401].forEach(status => {
    test(`${provider}: ${status} has one bounded set of wire attempts`, { timeout: 1500 }, async () => {
      const h = await fixture(provider, async config => { throw failure(config, status); });
      h.adapter.retryHandler.maxRetries = 3;
      await assert.rejects(h.api.send("Current question"));
      assert.equal(h.dispatches.length, status === 401 ? 1 : 3);
      assert.equal(h.waits.length, status === 401 ? 0 : 2);
      assert.deepEqual(h.adapter.getHistory(), h.before);
      assert.equal(h.api.pendingRequest, null);
    });
  });

  test(`${provider}: honors server delay and records one successful exchange`, { timeout: 1500 }, async () => {
    const h = await fixture(provider, async (config, count) => {
      if (count === 1) throw failure(config, 429, { "Retry-After": "7" });
      return data;
    });
    assert.equal(await h.api.send("Current question"), "Answer");
    assert.deepEqual(h.waits, [7000]);
    assert.equal(h.dispatches.length, 2);
    assert.equal(h.adapter.getHistory().length, h.before.length + 2);
    assert.ok(h.dispatches.every(config => config.signal instanceof AbortSignal));
  });

  test(`${provider}: cancellation reaches an active transport and preserves context`, { timeout: 1500 }, async () => {
    let started;
    const ready = new Promise(resolve => { started = resolve; });
    const h = await fixture(provider, config => new Promise((resolve, reject) => {
      config.signal.addEventListener("abort", () => reject(config.signal.reason), { once: true });
      started();
    }));
    const rejected = assert.rejects(h.api.send("Cancel me"), { name: "UserInterruptException" });
    await ready;
    h.api.cancelPendingRequest();
    await rejected;
    assert.equal(h.dispatches.length, 1);
    assert.deepEqual(h.waits, []);
    assert.deepEqual(h.adapter.getHistory(), h.before);
  });

  test(`${provider}: cancellation discards even a transport that responds late`, { timeout: 1500 }, async () => {
    let started;
    const ready = new Promise(resolve => { started = resolve; });
    const deferred = Promise.withResolvers();
    const response = deferred.promise;
    const h = await fixture(provider, async () => data);
    const client = h.adapter.restClient?.client || h.adapter.client;
    /**
     * Bypasses Axios cancellation to verify the adapter's own late-result guard.
     * @param {string} _url - Endpoint.
     * @param {object} _payload - Request payload.
     * @param {object} config - Transport options.
     * @returns {Promise<object>} Response even after abort.
     */
    client.post = async (_url, _payload, config) => {
      h.dispatches.push(config);
      started();
      return { data: await response };
    };
    const rejected = assert.rejects(h.api.send("Cancel me"), { name: "UserInterruptException" });
    await ready;
    h.api.cancelPendingRequest();
    await assert.rejects(h.api.send("Overlapping request"), /already active/u);
    deferred.resolve(data);
    await rejected;
    assert.equal(h.dispatches.length, 1);
    assert.deepEqual(h.adapter.getHistory(), h.before);
    assert.equal(await h.api.send("Next request"), "Answer");
  });

  test(`${provider}: cancellation stops backoff and rate-limit waits`, { timeout: 1500 }, async () => {
    const h = await fixture(provider, async config => { throw failure(config, 503); });
    /**
     * @param {number} _ms - Scheduled delay.
     * @param {AbortSignal} signal - Request cancellation.
     * @returns {Promise<void>} Cancellation of the wait.
     */
    h.adapter.retryHandler.sleep = async (_ms, signal) => {
      h.api.cancelPendingRequest();
      signal.throwIfAborted();
    };
    await assert.rejects(h.api.send("Cancel backoff"), { name: "UserInterruptException" });
    assert.equal(h.dispatches.length, 1);
    assert.deepEqual(h.adapter.getHistory(), h.before);
    h.settings.rpm_limit = 1;
    h.adapter.lastRequestTime = Date.now();
    const rejected = assert.rejects(h.api.send("Cancel rate wait"), { name: "UserInterruptException" });
    h.api.cancelPendingRequest();
    await rejected;
    assert.equal(h.dispatches.length, 1);
    assert.deepEqual(h.adapter.getHistory(), h.before);
  });

  test(`${provider}: deadline includes rate waits and aborts the active wire request`, { timeout: 1500 }, async (t) => {
    const ready = Promise.withResolvers();
    const h = await fixture(provider, config => new Promise((resolve, reject) => {
      config.signal.addEventListener("abort", () => reject(config.signal.reason), { once: true });
      ready.resolve(undefined);
    }));
    t.mock.timers.enable({ apis: ["setTimeout"] });
    h.adapter.retryHandler.maxElapsedMs = 100;
    const expiredTransport = assert.rejects(h.api.send("Timeout transport"), { name: "TimeoutError" });
    await ready.promise;
    t.mock.timers.tick(100);
    await expiredTransport;
    assert.equal(h.dispatches.length, 1);
    assert.deepEqual(h.adapter.getHistory(), h.before);
    h.settings.rpm_limit = 1;
    h.adapter.lastRequestTime = Date.now();
    const expiredWait = assert.rejects(h.api.send("Timeout rate wait"), { name: "TimeoutError" });
    t.mock.timers.tick(100);
    await expiredWait;
    assert.equal(h.dispatches.length, 1);
    assert.deepEqual(h.adapter.getHistory(), h.before);
  });
});
