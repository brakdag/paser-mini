import { test } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import readline from "node:readline";
import ApiCommunicator from "../src/core/ApiCommunicator.js";
import ChatManager from "../src/core/chatManager.js";
import CommandHandler from "../src/core/commandHandler.js";
import ModelCommands from "../src/core/commandHandlers/models.js";
import input from "../src/core/TerminalInput.js";
import GeminiAdapter from "../src/infrastructure/gemini/adapter.js";
import RetryHandler from "../src/utils/retryHandler.js";

/**
 * Creates a promise that test callbacks can resolve.
 * @returns {{promise: Promise<unknown>, resolve: (value?: unknown) => void}} The deferred result.
 */
function deferred() {
  let resolve;
  const promise = new Promise((resolvePromise) => { resolve = resolvePromise; });
  return { promise, resolve };
}

/**
 * Creates an offline Gemini adapter with no rate-limit delay.
 * @param {object} [ui] - The test interface.
 * @returns {GeminiAdapter} The adapter.
 */
function createAdapter(ui = {}) {
  const adapter = new GeminiAdapter({
    ui,
    configManager: { get(key, fallback) { return key === "rpm_limit" ? 60000000 : fallback; } },
  });
  adapter.providerId = "GEMINI";
  return adapter;
}

/**
 * Creates a transient Gemini service error.
 * @returns {Error} The simulated error.
 */
function serviceError() {
  return Object.assign(new Error("Unavailable"), { response: { status: 503 } });
}

test("/models cancels an in-flight initial message and the next turn uses the selected model", { timeout: 3000 }, async (t) => {
  const terminal = new EventEmitter();
  t.mock.method(readline, "createInterface", () => terminal);
  t.after(() => {
    input.rl = null;
    input.inputQueue = [];
    input.inputResolver = null;
    input.commandHandler = null;
  });

  const started = deferred();
  const changed = deferred();
  const errors = [];
  const messages = [];
  let manager;
  const ui = {
    setBashEnabled() {},
    setRenderingMode() {},
    setIdentities(user, model) { this.model = model; },
    setCommandHandler(handler) { input.commandHandler = handler; },
    initInput() { input.init(); },
    requestInput() { return input.requestInput(""); },
    getLogOpenedString() { return "Session opened"; },
    displayError(message) { errors.push(message); },
    displayInfo(message) {
      if (message.startsWith("Model changed to")) changed.resolve();
    },
    displayChatMessage(nick, message) {
      messages.push(message);
      if (message === "New model response") manager.requestExit();
    },
  };
  const adapter = createAdapter(ui);
  const urls = [];
  t.mock.method(adapter.client, "post", (url, payload, { signal }) => {
    urls.push(url);
    if (urls.length === 1) {
      return new Promise((resolve, reject) => {
        signal.addEventListener("abort", () => reject(signal.reason), { once: true });
        started.resolve(signal);
      });
    }
    return Promise.resolve({ data: { candidates: [{ content: { parts: [{ text: "New model response" }] } }] } });
  });
  const getModels = t.mock.method(adapter, "getAvailableModels", async () => {
    throw new Error("Changing by name must not fetch the catalog");
  });
  const settings = new Map();
  manager = new ChatManager({
    assistant: adapter,
    tools: {},
    systemInstruction: "Test prompt",
    ui,
    user: { nickname: "user" },
    model: { nickname: "agent", name: "models/old", temperature: 0.7 },
    configManager: {
      get(key, fallback) { return settings.has(key) ? settings.get(key) : fallback; },
      save(key, value) { settings.set(key, value); },
    },
  });

  const running = manager.run("Original request");
  const signal = await started.promise;
  terminal.emit("line", "/models models/new 0.4");
  await changed.promise;
  assert.equal(signal.aborted, true);
  assert.equal(adapter.getHistory().length, 0);
  assert.equal(manager.model.name, "models/new");
  assert.equal(manager.temperature, 0.4);
  assert.equal(settings.get("model_name"), "models/new");

  terminal.emit("line", "New request");
  await running;
  assert.match(urls[0], /\/old:generateContent/);
  assert.match(urls[1], /\/new:generateContent/);
  assert.equal(getModels.mock.callCount(), 0);
  assert.deepEqual(errors, []);
  assert.ok(messages.includes("New model response"));
  assert.equal(adapter.getHistory()[0].parts[0].text, "New request");
});

test("Gemini backoff is cancelled without another request or changes to earlier history", { timeout: 1000 }, async (t) => {
  const retrying = deferred();
  const adapter = createAdapter({ displayInfo() { retrying.resolve(); } });
  adapter.injectMessage("user", "Earlier context");
  const post = t.mock.method(adapter.client, "post", async () => { throw serviceError(); });
  const api = new ApiCommunicator(adapter, {});
  const pending = api.send("Pending request");
  const rejected = assert.rejects(pending, { name: "UserInterruptException" });
  await retrying.promise;
  api.cancelPendingRequest();
  await rejected;
  assert.equal(post.mock.callCount(), 1);
  assert.equal(adapter.getHistory().length, 1);
  assert.equal(adapter.getHistory()[0].parts[0].text, "Earlier context");
  assert.equal(api.pendingRequest, null);
});

test("the communicator never retries an adapter failure", async () => {
  let attempts = 0;
  const failure = serviceError();
  const api = new ApiCommunicator({
    async sendMessage() { attempts += 1; throw failure; },
  }, {});
  await assert.rejects(api.send("Request"), error => error === failure);
  assert.equal(attempts, 1);
});

test("cancelling the Gemini rate-limit wait sends no HTTP request", { timeout: 1000 }, async (t) => {
  const adapter = createAdapter();
  /**
   * Forces a rate-limit wait to exercise cancellation.
   * @param {string} key - Setting name.
   * @param {unknown} fallback - Default value.
   * @returns {unknown} RPM setting or default value.
   */
  adapter.configManager.get = (key, fallback) => key === "rpm_limit" ? 1 : fallback;
  adapter.lastRequestTime = Date.now();
  const post = t.mock.method(adapter.client, "post");
  const api = new ApiCommunicator(adapter, {});
  const rejected = assert.rejects(api.send("Request"), { name: "UserInterruptException" });
  api.cancelPendingRequest();
  await rejected;
  assert.equal(post.mock.callCount(), 0);
  assert.deepEqual(adapter.getHistory(), []);
});

test("a late HTTP response after cancellation is discarded", { timeout: 1000 }, async (t) => {
  const started = deferred();
  const response = deferred();
  const adapter = createAdapter();
  t.mock.method(adapter.client, "post", () => { started.resolve(); return response.promise; });
  const api = new ApiCommunicator(adapter, {});
  const rejected = assert.rejects(api.send("Request"), { name: "UserInterruptException" });
  await started.promise;
  api.cancelPendingRequest();
  response.resolve({ data: { candidates: [{ content: { parts: [{ text: "Stale response" }] } }] } });
  await rejected;
  assert.deepEqual(adapter.getHistory(), []);
});

test("/models still lists models and selects a filtered index", async () => {
  const menus = [];
  const errors = [];
  const settings = new Map([["unavailable_models", ["models/hidden"]]]);
  const chatManager = {
    assistant: {
      async getAvailableModels() { return ["models/hidden", "models/available"]; },
      startChat(name) { this.currentModel = name; },
    },
    model: { name: "old", temperature: 0.7 },
    temperature: 0.7,
    configManager: { get(key, fallback) { return settings.get(key) ?? fallback; }, save() {} },
  };
  const ui = {
    displayMenu(title, models) { menus.push(models); },
    displayInfo() {},
    displayError(message) { errors.push(message); },
  };
  await ModelCommands.handleModels(chatManager, ui, ["/models"]);
  await ModelCommands.handleModels(chatManager, ui, ["/models", "0"]);
  assert.deepEqual(menus, [["models/available"]]);
  assert.equal(chatManager.assistant.currentModel, "models/available");
  assert.equal(chatManager.model.name, "models/available");
  assert.deepEqual(errors, []);
});

test("only /models interrupts active requests for every provider, including arguments and mixed case", () => {
  let cancelled = 0;
  const manager = {
    assistant: { providerId: "GEMINI" },
    turnProcessor: { cancelPendingTurn() { cancelled += 1; } },
  };
  const handler = new CommandHandler(
    /** @type {import("../src/core/chatManager.js").default} */ (/** @type {unknown} */ (manager)), {},
  );
  assert.equal(handler.interruptForModelChange("/models"), true);
  assert.equal(handler.interruptForModelChange(" /MoDeLs models/new "), true);
  assert.equal(handler.interruptForModelChange("/models-invalid"), false);
  assert.equal(handler.interruptForModelChange("/connect groq"), false);
  assert.equal(handler.interruptForModelChange("ordinary input"), false);
  manager.assistant.providerId = "GROQ";
  assert.equal(handler.interruptForModelChange("/models"), true);
  assert.equal(cancelled, 3);
});

test("RetryHandler continues retrying normally when not cancelled", async () => {
  const retry = new RetryHandler(2, 1);
  let attempts = 0;
  const response = await retry.execute(async () => {
    attempts += 1;
    if (attempts === 1) throw serviceError();
    return "Recovered";
  });
  assert.equal(response, "Recovered");
  assert.equal(attempts, 2);
});
