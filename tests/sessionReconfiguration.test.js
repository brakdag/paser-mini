import { test } from "node:test";
import assert from "node:assert/strict";
import createSession from "../src/core/sessionFactory.js";
import ProviderManager from "../src/infrastructure/providerManager.js";
import { SystemTools } from "../src/tools/systemTools.js";

/**
 * Creates a real session with offline configuration and tool contexts.
 * @param {object} [options] - Session options.
 * @returns {Promise<object>} Session fixture.
 */
async function fixture(options = {}) {
  const values = { provider: "GEMINI", model_name: "old-model", execute_enabled: true, compatible_base_url: "http://localhost:9999/v1" };
  const saved = [];
  const info = [];
  const errors = [];
  const configManager = {
    get(key, fallback) { return key in values ? values[key] : fallback; },
    save(key, value) { values[key] = value; saved.push(key); },
    setTemporary(key, value) { values[key] = value; },
  };
  const ui = {
    inputQueue: [],
    setBashEnabled(active) { this.bashEnabled = active; },
    setCommandHandler() {},
    startToolMonitoring() {},
    endToolMonitoring() {},
    setRenderingMode(mode) { this.renderingMode = mode; },
    setIdentities() {},
    displayInfo(message) { info.push(message); },
    displayError(message) { errors.push(message); },
  };
  const contexts = {};
  const system = new SystemTools();
  const holders = {
    systemTools: system,
    memoryTools: { setMemoryContext(manager) { contexts.memory = manager; } },
    utilTools: { setIdentityContext(model) { contexts.model = model; } },
  };
  const providerManager = new ProviderManager();
  const create = providerManager.createAdapter.bind(providerManager);
  /**
   * Builds real adapters with offline metadata transport.
   * @param {object} params - Adapter options.
   * @returns {Promise<object>} Offline adapter.
   */
  providerManager.createAdapter = async params => {
    const adapter = await create(params);
    if (adapter.client) {
      /**
       * Supplies model metadata without contacting a provider.
       * @returns {Promise<object>} Offline metadata response.
       */
      adapter.client.get = async () => ({ data: { context_length: 8000 } });
    }
    return adapter;
  };
  const manager = await createSession({
    ui, configManager, providerManager, systemInstruction: "Session prompt", tools: {},
    async resolveTool(name) { return holders[name]; }, ...options,
  });
  await manager.initializeSession();
  return { manager, values, saved, info, errors, contexts, system };
}

new ProviderManager().getProviders().forEach(({ id, defaultModel }) => {
  test(`switch to ${id} reapplies modes, identities, prompt and reset context`, async () => {
    const h = await fixture();
    const { manager } = h;
    manager.setRenderingMode("FOUNTAIN");
    manager.setImmersionMode(true);
    manager.assistant.injectMessage("user", "Old history");
    const previous = manager.assistant;
    const before = structuredClone(previous.getHistory());
    await manager.switchProvider({ providerId: id, modelName: defaultModel || "old-model", temp: 0.2 });
    let next = manager.assistant;
    assert.notEqual(next, previous);
    assert.equal(next.user, manager.user);
    assert.equal(next.model, manager.model);
    assert.equal(next.currentModel, defaultModel || "old-model");
    assert.equal(next.temperature, 0.2);
    assert.equal(next.renderingMode, "FOUNTAIN");
    assert.equal(next.immersionMode, true);
    assert.equal(next.systemInstruction, "Session prompt");
    assert.equal(manager.turnProcessor.assistant, next);
    assert.equal(manager.turnProcessor.api.assistant, next);
    assert.equal(manager.ui.bashEnabled, true);
    assert.equal(h.contexts.memory, manager);
    assert.equal(h.contexts.model, manager.model);
    if (id === "GEMINI") assert.deepEqual(next.getHistory(), before);
    else assert.doesNotMatch(JSON.stringify(next.getHistory()), /Old history/);
    next.injectMessage("user", "Native history");
    Object.assign(next.getHistory().at(-1), { contextTurn: "kept-turn", attachment: { data: [1, 2, 3] } });
    const nativeHistory = structuredClone(next.getHistory());
    await manager.switchProvider({ providerId: id, modelName: "another-model", temp: 0.4 });
    next = manager.assistant;
    assert.deepEqual(next.getHistory(), nativeHistory);
    next.getHistory().at(-1).attachment.data.push(4);
    assert.deepEqual(nativeHistory.at(-1).attachment.data, [1, 2, 3]);
    next.injectMessage("user", "Reset me");
    await h.system.reset("Continue after reset");
    assert.doesNotMatch(JSON.stringify(next.getHistory()), /Reset me/);
    assert.deepEqual(previous.getHistory(), before);
    assert.deepEqual(manager.ui.inputQueue, ["Continue after reset"]);
  });
});

["creation", "start", "budget"].forEach(stage => {
  test(`failed ${stage} preserves the old session and allows a retry`, async (t) => {
    const h = await fixture();
    const { manager } = h;
    const old = manager.assistant;
    old.injectMessage("user", "Keep this conversation");
    const history = structuredClone(old.getHistory());
    const model = structuredClone(manager.model);
    const create = manager.providerManager.createAdapter.bind(manager.providerManager);
    const failure = new Error(`Failed ${stage}`);
    const stub = t.mock.method(manager.providerManager, "createAdapter", async params => {
      if (stage === "creation") throw failure;
      const candidate = await create(params);
      if (stage === "start") {
        /** Simulates asynchronous adapter initialization failure. */
        candidate.startChat = async () => { candidate.model.nickname = "Broken identity"; throw failure; };
      }
      if (stage === "budget") {
        /** Rejects a candidate whose context policy cannot be applied. */
        candidate.checkContextLimit = () => { throw failure; };
      }
      return candidate;
    });
    await assert.rejects(manager.switchProvider({ providerId: "OPENROUTER", modelName: "new-model", temp: 0.3 }), failure);
    assert.equal(manager.assistant, old);
    assert.equal(manager.turnProcessor.api.assistant, old);
    assert.deepEqual(manager.model, model);
    assert.deepEqual(old.getHistory(), history);
    assert.equal(h.values.provider, "GEMINI");
    assert.equal(manager._reconfiguring, false);
    stub.mock.restore();
    await manager.switchProvider({ providerId: "GEMINI", modelName: "recovered", temp: 0.4 });
    assert.deepEqual(manager.assistant.getHistory(), history);
    assert.equal(manager.model.name, "recovered");
  });
});

test("pure session can enable tools and later disable them with matching catalog and policy", async () => {
  const h = await fixture({ pureMode: true });
  assert.deepEqual(h.contexts, {});
  let calls = 0;
  const tools = { read() { calls += 1; return "Contents"; } };
  await h.manager.updateSystemContext("Tools prompt", tools, false);
  assert.equal(h.contexts.memory, h.manager);
  assert.equal(h.manager.engine.tools, tools);
  assert.equal(h.manager.turnProcessor.tools, tools);
  assert.equal((await h.manager.engine.executeToolCall("read", { path: "fixture.txt" })).success, true);
  await h.manager.updateSystemContext("Pure prompt", {}, true);
  assert.equal(h.manager.engine.strictPureMode, true);
  assert.equal((await h.manager.engine.executeToolCall("read", { path: "fixture.txt" })).success, false);
  assert.equal(calls, 1);
});

test("failed prompt update restores history, prompt, tools and mode", async (t) => {
  const { manager } = await fixture();
  const before = structuredClone(manager.assistant.getHistory());
  const { tools } = manager;
  t.mock.method(manager.assistant, "updateSystemInstruction", () => {
    manager.assistant.systemInstruction = "Broken";
    manager.assistant.getHistory().push({ role: "user", parts: [{ text: "Broken" }] });
    throw new Error("Prompt failed");
  });
  await assert.rejects(manager.updateSystemContext("New", { read() {} }, true), /Prompt failed/);
  assert.equal(manager.systemInstruction, "Session prompt");
  assert.equal(manager.assistant.systemInstruction, "Session prompt");
  assert.equal(manager.tools, tools);
  assert.equal(manager.engine.strictPureMode, false);
  assert.deepEqual(manager.assistant.getHistory(), before);
});

test("models and same-provider favorites update shared model and retain history", async () => {
  const h = await fixture();
  h.manager.assistant.injectMessage("user", "Keep history");
  const history = structuredClone(h.manager.assistant.getHistory());
  await h.manager.commandHandler.handle("/models new-model 0.3");
  assert.equal(h.manager.model.name, "new-model");
  assert.equal(h.manager.model.temperature, 0.3);
  assert.deepEqual(h.manager.assistant.getHistory(), history);
  h.values.favorites = [{ provider: "GEMINI", model: "favorite-model", temp: 0.1 }];
  await h.manager.commandHandler.handle("/fav 0");
  assert.equal(h.manager.model.name, "favorite-model");
  assert.equal(h.manager.assistant.currentModel, "favorite-model");
  assert.equal(h.manager.temperature, 0.1);
  assert.deepEqual(h.manager.assistant.getHistory(), history);
  assert.deepEqual(h.errors, []);
});

test("overlapping switches and turns cannot modify a pending reconfiguration", async (t) => {
  const { manager } = await fixture();
  const create = manager.providerManager.createAdapter.bind(manager.providerManager);
  const { promise: gate, resolve: release } = Promise.withResolvers();
  t.mock.method(manager.providerManager, "createAdapter", async params => { await gate; return create(params); });
  const change = { providerId: "OPENROUTER", modelName: "new", temp: 0.3 };
  const pending = manager.switchProvider(change);
  await assert.rejects(manager.switchProvider(change), /reconfiguration/);
  await assert.rejects(manager.processTurn("Hello"), /reconfiguration/);
  await assert.rejects(manager.updateSystemContext("New prompt", {}), /reconfiguration/);
  release(undefined);
  await pending;
  manager._turnInProgress = true;
  await assert.rejects(manager.switchProvider(change), /active turn/);
});

test("failed /models leaves model, config and transport usable", async (t) => {
  const h = await fixture();
  const old = h.manager.assistant;
  const start = t.mock.method(h.manager.providerManager, "createAdapter", async () => { throw new Error("No connection"); });
  await h.manager.commandHandler.handle("/models failed-model 0.5");
  assert.equal(h.manager.assistant, old);
  assert.equal(h.manager.model.name, "old-model");
  assert.equal(h.values.model_name, "old-model");
  assert.deepEqual(h.saved, ["rendering_mode"]);
  assert.match(h.errors.at(-1), /No connection/);
  t.mock.method(old.client, "post", async () => ({ data: { candidates: [{ content: { parts: [{ text: "Still usable" }] } }] } }));
  assert.equal(await old.sendMessage("Hello"), "Still usable");
  start.mock.restore();
  await assert.rejects(h.manager.setTemperature(Number.NaN), /finite temperature/);
});

test("failed tool resolution leaves pure session usable and can be retried", async () => {
  let fail = true;
  const h = await fixture({ pureMode: true, async resolveTool() {
    if (fail) throw new Error("Cannot load tools");
    return { setContext() {}, setMemoryContext() {}, setIdentityContext() {} };
  } });
  await assert.rejects(h.manager.updateSystemContext("Tools", {}, false), /Cannot load tools/);
  assert.equal(h.manager.pureMode, true);
  assert.equal(h.manager.systemInstruction, "Session prompt");
  assert.equal(h.manager._reconfiguring, false);
  fail = false;
  await h.manager.updateSystemContext("Tools", {}, false);
  assert.equal(h.manager.pureMode, false);
});

test("connect and cross-provider favorite persist selection and retain denied execute permission", async () => {
  const h = await fixture();
  h.manager.ui.setBashEnabled(false);
  await h.manager.commandHandler.handle("/connect OPENROUTER");
  assert.equal(h.manager.assistant.providerId, "OPENROUTER");
  assert.equal(h.values.provider, "OPENROUTER");
  assert.equal(h.values.model_name, h.manager.model.name);
  h.values.favorites = [{ provider: "GEMINI", model: "favorite", temp: 0.6 }];
  await h.manager.commandHandler.handle("/fav 0");
  assert.equal(h.manager.assistant.providerId, "GEMINI");
  assert.equal(h.values.provider, "GEMINI");
  assert.equal(h.manager.model.name, "favorite");
  assert.equal(h.values.default_temperature, 0.6);
  assert.equal(h.manager.ui.bashEnabled, false);
  assert.equal((await h.manager.engine.executeToolCall("execute", { command: "echo blocked" })).success, false);
  assert.deepEqual(h.errors, []);
});
