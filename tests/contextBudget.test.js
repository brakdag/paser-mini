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
  test(`${provider}: truncates oversized current input and continues through transport`, async (t) => {
    const { adapter, settings, payloads, information } = await fixture(t, provider);
    adapter.injectMessage("user", "Earlier question");
    adapter.injectMessage("model", "Earlier answer");
    settings.context_window_limit = adapter.getMaxOutputTokens() + 800;
    assert.equal(await adapter.sendMessage(`${"CURRENT_SOURCE_".repeat(2000)}LATEST_END`), "Answer");
    assert.equal(payloads.length, 1);
    const serialized = JSON.stringify(payloads[0]);
    assert.ok(serialized.includes("[Context truncated]"));
    assert.ok(serialized.includes("LATEST_END"));
    assert.ok(serialized.length < 4000);
    assert.ok(information.length > 0);
    assert.equal(await adapter.sendMessage("Short question"), "Answer");
    assert.equal(payloads.length, 2);
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

  test(`${provider}: truncates formatting overhead before transport`, async (t) => {
    const { adapter, settings, payloads } = await fixture(t, provider);
    settings.context_window_limit = adapter.getMaxOutputTokens() + 900;
    t.mock.method(adapter, "formatTextForPayload", (role, text) => role === "system" ? text : "formatting".repeat(3000));
    assert.equal(await adapter.sendMessage("Short question"), "Answer");
    assert.equal(payloads.length, 1);
    assert.ok(JSON.stringify(payloads[0]).includes("[Context truncated]"));
    assert.ok(JSON.stringify(payloads[0]).length < 4000);
    const { messages, contents, ...extra } = payloads[0];
    const input = estimateContextTokens(messages || contents, "", adapter.getCharsPerToken(), extra);
    assert.ok(input + adapter.getMaxOutputTokens() + 500 <= settings.context_window_limit);
  });
});

test("truncation preserves structured blocks, pinned instructions and payload schemas", () => {
  const media = { inline_data: { mime_type: "image/png", data: "YWJj".repeat(1000) } };
  const messages = [
    { role: "system", content: "System rules ".repeat(1000) },
    { role: "developer", content: "Developer rules ".repeat(1000) },
    { role: "user", parts: [{ text: `HEAD${" output ".repeat(10000)}TAIL` }, media], contextTurn: "active" },
  ];
  const extra = { tools: [{ name: "example", description: "Schema ".repeat(1000) }] };
  const before = structuredClone({ messages, extra });
  const retained = planContext(messages, contextSettings(1, 4096, 3.5), "", extra);
  assert.deepEqual(retained.slice(0, 2), messages.slice(0, 2));
  assert.deepEqual(retained[2].parts[1], media);
  assert.match(retained[2].parts[0].text, /^HEAD.*\[Context truncated\].*TAIL$/s);
  assert.equal(retained[2].contextTurn, "active");
  assert.deepEqual({ messages, extra }, before);
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
  assert.ok(estimateContextTokens(planContext(parts, contextSettings(600, 64, 3.5), ""), "", 3.5) <= 100);
  assert.deepEqual(parts, before);
});

test("media and wire framing carry an explicit estimate, including extra tool schemas", () => {
  const image = [{ role: "user", parts: [{ text: "Look" }, { inline_data: { mime_type: "image/png", data: "YWJj" } }] }];
  const text = [{ role: "user", parts: [{ text: "Look" }] }];
  assert.ok(estimateContextTokens(image, "", 3.5) >= estimateContextTokens(text, "", 3.5) + 2048);
  assert.deepEqual(planContext(image, contextSettings(1000, 64, 3.5), ""), image);
  assert.ok(estimateContextTokens(text, "", 3.5, { tools: "schema".repeat(500) }) > 800);
});

test("impossible local limits preserve instructions and allow a soft minimum", () => {
  const messages = [{ role: "user", content: "unchanged", contextTurn: "current" }];
  const before = structuredClone(messages);
  assert.deepEqual(planContext(messages, contextSettings(1000, 64, 3.5), "system".repeat(1000)), messages);
  assert.deepEqual(messages, before);
  assert.equal(contextSettings(100, 64, 3.5).limit, 100);
  [0, -1, 1.5, Infinity, NaN, "12x", true, null, ""].forEach(value => {
    assert.throws(() => contextSettings(8000, value, 3.5), /CONTEXT_CONFIG/);
  });
  assert.deepEqual(planContext(messages, contextSettings(0, 64, 3.5), "x".repeat(10000)), messages);
});

test("an oversized tool result is shortened and the active turn continues", async (t) => {
  const { adapter, settings, payloads } = await fixture(t);
  await adapter.sendMessage("Older turn");
  settings.context_window_limit = 1000;
  adapter.beginContextTurn();
  t.after(() => adapter.endContextTurn());
  await adapter.sendMessage("Current original question");
  await adapter.sendMessage("Tool result");
  const current = adapter.getHistory().filter(message => message.contextTurn === adapter.getHistory().at(-1).contextTurn);
  assert.equal(current.length, 4);
  const calls = payloads.length;
  assert.equal(await adapter.sendMessage("Huge tool result".repeat(1000)), "Answer");
  assert.equal(payloads.length, calls + 1);
  assert.ok(JSON.stringify(payloads.at(-1)).includes("[Context truncated]"));
  assert.equal(await adapter.sendMessage("Continue with next tool result"), "Answer");
});

test("a long active tool turn reports its preserved minimum once without claiming no-op trims", async (t) => {
  const { adapter, settings, payloads, information } = await fixture(t);
  settings.context_window_limit = 30000;
  adapter.beginContextTurn();
  t.after(() => adapter.endContextTurn());
  await adapter.sendMessage("Original task");
  const { contextTurn } = adapter.getHistory().at(-1);
  payloads.length = 0;
  // Hundreds of exchanges in one user turn cannot be removed as older turns.
  for (let index = 0; index < 800; index += 1) {
    adapter.injectMessage(index % 2 ? "model" : "user", "x".repeat(128));
    adapter.getHistory().at(-1).contextTurn = contextTurn;
  }
  await adapter.sendMessage("Latest tool result");
  const { contents, ...extra } = payloads.at(-1);
  const total = estimateContextTokens(contents, "", adapter.getCharsPerToken(), extra) + adapter.getMaxOutputTokens() + 500;
  assert.ok(total > 30000);
  assert.ok(information.some(message => message.includes(`~${total} tokens`) && message.includes("above target 30000")));
  assert.ok(!information.some(message => /shortened|removed 0/u.test(message)));
  const notices = information.length;
  await adapter.sendMessage("Next tool result");
  assert.equal(information.length, notices);
  assert.equal(payloads.length, 2);
  assert.ok(JSON.stringify(payloads.at(-1)).includes("Next tool result"));
  adapter.endContextTurn();
  adapter.beginContextTurn();
  adapter._validateContextPayload(structuredClone(payloads[0]));
  assert.equal(information.length, notices + 1);
});

test("history and formatted payload trimming share one notice through tool exchanges and retries", async (t) => {
  const { adapter, settings, payloads, information } = await fixture(t);
  settings.context_window_limit = 1000;
  adapter.beginContextTurn();
  t.after(() => adapter.endContextTurn());
  await adapter.sendMessage("Huge snapshot ".repeat(2000));
  await adapter.sendMessage("Another snapshot ".repeat(2000));
  assert.equal(information.filter(message => message.includes("Context estimate:")).length, 1);
  assert.ok(!information.some(message => /removed 0/u.test(message)));
  const payload = structuredClone(payloads.at(-1));
  adapter._validateContextPayload(payload);
  adapter._validateContextPayload(payload);
  assert.equal(information.length, 1);
  settings.context_window_limit = 900;
  await adapter.sendMessage("Changed limit snapshot ".repeat(2000));
  assert.ok(information.some(message => message.includes("target 900")));
});

test("text already at its preserved minimum is unchanged even above budget", () => {
  const messages = [{ role: "user", parts: [{ text: "x".repeat(128) }], contextTurn: "active" }];
  const retained = planContext(messages, contextSettings(1, 64, 3.5), "");
  assert.equal(retained[0], messages[0]);
  assert.equal(retained[0].parts, messages[0].parts);
});

test("transport failure still restores history after truncation", async (t) => {
  const { adapter, settings } = await fixture(t, "nvidia");
  await adapter.sendMessage("Earlier question".repeat(500));
  settings.context_window_limit = adapter.getMaxOutputTokens() + 900;
  const before = structuredClone(adapter.getHistory());
  t.mock.method(adapter.restClient, "chatCompletions", async () => { throw new Error("Transport failed"); });
  t.mock.method(adapter.retryHandler, "execute", async operation => operation());
  await assert.rejects(adapter.sendMessage("Huge result".repeat(1000)), /Transport failed/);
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

test("small budgets are saved without changing history during validation", async (t) => {
  const { adapter } = await fixture(t);
  const manager = Object.create(ChatManager.prototype);
  manager.assistant = adapter;
  manager.contextWindowLimit = 0;
  let saved;
  /**
   * Records persistence without writing user configuration.
   * @param {string} key - Setting name.
   * @param {number} value - New limit.
   */
  manager.saveConfig = (key, value) => { saved = [key, value]; };
  const before = structuredClone(adapter.getHistory());
  manager.setContextWindowLimit(50);
  assert.equal(manager.contextWindowLimit, 50);
  assert.deepEqual(saved, ["context_window_limit", 50]);
  assert.deepEqual(adapter.getHistory(), before);
});

providers.forEach(provider => {
  test(`${provider}: tiny budget and large system prompt never block sending`, async (t) => {
    const { adapter, settings, payloads } = await fixture(t, provider);
    const system = "Preserve these instructions. ".repeat(1000).trim();
    adapter.updateSystemInstruction(system);
    settings.context_window_limit = 1;
    assert.equal(await adapter.sendMessage("Large tool output ".repeat(1000)), "Answer");
    assert.ok(JSON.stringify(payloads[0]).includes(system));
    assert.ok(JSON.stringify(payloads[0]).includes("[Context truncated]"));
  });
});
