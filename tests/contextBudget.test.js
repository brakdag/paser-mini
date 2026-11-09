import { test } from "node:test";
import assert from "node:assert/strict";
import { contextSettings, estimateContextTokens, planContext } from "../src/infrastructure/contextBudget.js";
import ChatManager from "../src/core/chatManager.js";

const providers = ["gemini", "nvidia", "nvidia-minimax", "cohere", "zai", "groq", "cerebras", "cloudflare", "openrouter", "huggingface", "poolside", "zenmux"];

/**
 * Creates a real adapter with simulated transport and mutable local settings.
 * @param {import('node:test').TestContext} t - Mock owner.
 * @param {string} provider - Provider module.
 * @returns {Promise<object>} Adapter, settings and sent payloads.
 */
async function fixture(t, provider = "gemini") {
  const { default: Adapter } = await import(`../src/infrastructure/${provider}/adapter.js`);
  const settings = { context_window_limit: 0, max_tokens: 64, rpm_limit: 60000000 };
  const information = [];
  const adapter = new Adapter({
    ui: { displayInfo(message) { information.push(message); } },
    configManager: { get(key, fallback) { return settings[key] ?? fallback; } },
  });
  adapter.updateSystemInstruction("System prompt");
  const payloads = [];
  const data = {
    choices: [{ message: { content: "Answer" } }],
    candidates: [{ content: { parts: [{ text: "Answer" }] } }],
    message: { content: [{ text: "Answer" }] },
  };
  if (adapter.restClient) {
    t.mock.method(adapter.restClient, "chatCompletions", async payload => { payloads.push(structuredClone(payload)); return data; });
  } else {
    t.mock.method(adapter.client, "post", async (_url, payload) => { payloads.push(structuredClone(payload)); return { data }; });
  }
  return { adapter, settings, payloads, information };
}

providers.forEach(provider => {
  test(`${provider}: rejects an oversized current input before transport and restores history`, async (t) => {
    const { adapter, settings, payloads } = await fixture(t, provider);
    adapter.injectMessage("user", "Earlier question");
    adapter.injectMessage("model", "Earlier answer");
    const before = structuredClone(adapter.getHistory());
    settings.context_window_limit = adapter.getMaxOutputTokens() + 800;
    await assert.rejects(adapter.sendMessage("CURRENT_SOURCE_".repeat(2000)), /CONTEXT_BUDGET/);
    assert.equal(payloads.length, 0);
    assert.deepEqual(adapter.getHistory(), before);
    assert.equal(await adapter.sendMessage("Short question"), "Answer");
    assert.equal(payloads.length, 1);
  });

  test(`${provider}: removes complete older turns and preserves current source in the final payload`, async (t) => {
    const { adapter, settings, payloads, information } = await fixture(t, provider);
    await adapter.sendMessage("OLD_UNIT_".repeat(500));
    settings.context_window_limit = adapter.getMaxOutputTokens() + 900;
    const current = "const result = wholeFunction(); // Preserve every character";
    assert.equal(await adapter.sendMessage(current), "Answer");
    const payload = payloads.at(-1);
    const serialized = JSON.stringify(payload);
    assert.ok(serialized.includes(current));
    assert.ok(!serialized.includes("OLD_UNIT_"));
    assert.ok(!serialized.includes("contextTurn"));
    assert.ok(information.some(message => /complete older turns/u.test(message)));
    assert.equal(adapter.getHistory().filter(message => message.role !== "system").length, 2);
  });

  test(`${provider}: checks formatting overhead before transport`, async (t) => {
    const { adapter, settings, payloads } = await fixture(t, provider);
    settings.context_window_limit = adapter.getMaxOutputTokens() + 900;
    const before = structuredClone(adapter.getHistory());
    t.mock.method(adapter, "formatTextForPayload", () => "formatting".repeat(3000));
    await assert.rejects(adapter.sendMessage("Short question"), /CONTEXT_BUDGET/);
    assert.equal(payloads.length, 0);
    assert.deepEqual(adapter.getHistory(), before);
  });
});

test("common normalization measures content, text and all parts and counts system once", () => {
  const shape = [
    [{ role: "user", content: "abcdefgh" }],
    [{ role: "user", text: "abcdefgh" }],
  ];
  assert.equal(estimateContextTokens(shape[0], "system", 3.5), estimateContextTokens(shape[1], "system", 3.5));
  const messages = [{ role: "system", content: "system" }, ...shape[0]];
  assert.equal(estimateContextTokens(messages, "system", 3.5), estimateContextTokens(messages, "", 3.5));
  assert.ok(estimateContextTokens(messages, "different system", 3.5) > estimateContextTokens(messages, "", 3.5));
  const parts = [{ role: "user", parts: [{ text: "a".repeat(100) }, { text: "b".repeat(100) }] }];
  assert.ok(estimateContextTokens(parts, "", 3.5) > 200 / 3.5);
  const before = structuredClone(parts);
  assert.throws(() => planContext(parts, contextSettings(600, 64, 3.5), ""), /CONTEXT_BUDGET/);
  assert.deepEqual(parts, before);
});

test("media and wire framing carry an explicit estimate, including extra tool schemas", () => {
  const image = [{ role: "user", parts: [{ text: "Look" }, { inline_data: { mime_type: "image/png", data: "YWJj" } }] }];
  const text = [{ role: "user", parts: [{ text: "Look" }] }];
  assert.ok(estimateContextTokens(image, "", 3.5) >= estimateContextTokens(text, "", 3.5) + 2048);
  assert.throws(() => planContext(image, contextSettings(1000, 64, 3.5), ""), /CONTEXT_BUDGET/);
  assert.ok(estimateContextTokens(text, "", 3.5, { tools: "schema".repeat(500) }) > 800);
});

test("no fragment of an impossible system/current turn is silently cut", () => {
  const messages = [{ role: "user", content: "unchanged", contextTurn: "current" }];
  const before = structuredClone(messages);
  assert.throws(() => planContext(messages, contextSettings(1000, 64, 3.5), "system".repeat(1000)), /CONTEXT_BUDGET/);
  assert.deepEqual(messages, before);
  assert.throws(() => contextSettings(100, 64, 3.5), /CONTEXT_BUDGET/);
  [0, -1, 1.5, Infinity, NaN, "12x", true, null, ""].forEach(value => {
    assert.throws(() => contextSettings(8000, value, 3.5), /CONTEXT_CONFIG/);
  });
  assert.deepEqual(planContext(messages, contextSettings(0, 64, 3.5), "x".repeat(10000)), messages);
});

test("all tool exchanges of the active turn survive or are rejected together", async (t) => {
  const { adapter, settings, payloads } = await fixture(t);
  await adapter.sendMessage("Older turn");
  settings.context_window_limit = 1000;
  adapter.beginContextTurn();
  t.after(() => adapter.endContextTurn());
  await adapter.sendMessage("Current original question");
  await adapter.sendMessage("Tool result");
  const current = adapter.getHistory().filter(message => message.contextTurn === adapter.getHistory().at(-1).contextTurn);
  assert.equal(current.length, 4);
  const before = structuredClone(adapter.getHistory());
  const calls = payloads.length;
  await assert.rejects(adapter.sendMessage("Huge tool result".repeat(1000)), /CONTEXT_BUDGET/);
  assert.equal(payloads.length, calls);
  assert.deepEqual(adapter.getHistory(), before);
});

test("formatting expansion is checked before HTTP and failure restores pruned history", async (t) => {
  const { adapter, settings, payloads } = await fixture(t);
  await adapter.sendMessage("Earlier question");
  settings.context_window_limit = 1000;
  const before = structuredClone(adapter.getHistory());
  t.mock.method(adapter, "formatTextForPayload", () => "formatted overhead".repeat(1000));
  await assert.rejects(adapter.sendMessage("Short question"), /CONTEXT_BUDGET/);
  assert.equal(payloads.length, 1);
  assert.deepEqual(adapter.getHistory(), before);
});

test("context usage indicator labels disabled limits and shares the reserve", async (t) => {
  const { adapter, settings } = await fixture(t);
  const manager = Object.create(ChatManager.prototype);
  manager.assistant = adapter;
  manager.systemInstruction = adapter.systemInstruction;
  manager.contextWindowLimit = 0;
  assert.match(manager.getTokenCount(), /local limit disabled/);
  assert.doesNotMatch(manager.getTokenCount(), /250000|%/);
  settings.context_window_limit = 8000;
  const usage = adapter.getContextUsage();
  assert.ok(manager.getTokenCount().includes(`~${usage.input + 564}/8000`));
  assert.match(manager.getTokenCount(), /564 reserved/);
});

test("proposed budgets are rejected before saving or modifying history", async (t) => {
  const { adapter } = await fixture(t);
  const manager = Object.create(ChatManager.prototype);
  manager.assistant = adapter;
  manager.contextWindowLimit = 0;
  /** Fails if an invalid setting reaches persistence. */
  manager.saveConfig = () => { throw new Error("must not save an invalid budget"); };
  const before = structuredClone(adapter.getHistory());
  assert.throws(() => manager.setContextWindowLimit(50), /CONTEXT_BUDGET/);
  assert.equal(manager.contextWindowLimit, 0);
  assert.deepEqual(adapter.getHistory(), before);
});
