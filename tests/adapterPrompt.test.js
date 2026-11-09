import { test } from "node:test";
import assert from "node:assert/strict";

const providers = [
  ["gemini", false], ["nvidia", false], ["nvidia-minimax", false],
  ["cohere", false], ["zai", false],
  ["groq", true], ["cerebras", true], ["cloudflare", true],
  ["openrouter", true], ["huggingface", true], ["poolside", true], ["zenmux", true],
];

providers.forEach(([provider, usesSystemMessage]) => {
  test(`${provider} replaces, removes and restores the prompt while preserving conversation`, async (t) => {
    const { default: Adapter } = await import(`../src/infrastructure/${provider}/adapter.js`);
    const adapter = new Adapter({
      ui: {}, configManager: { get(_key, fallback) { return fallback; } },
    });
    if (provider === "cerebras") t.mock.method(adapter, "_syncContextLimit", async () => {});
    await adapter.startChat("test-model", "Old prompt", 0.3);
    adapter.injectMessage("user", "Question");
    adapter.injectMessage("model", "Answer");
    const conversation = structuredClone(adapter.getHistory().filter(entry => entry.role !== "system"));
    const restart = t.mock.method(adapter, "startChat", () => {
      throw new Error("Prompt updates must not restart the model or fetch metadata");
    });

    ["New prompt", "", "Restored prompt"].forEach((prompt) => {
      adapter.updateSystemInstruction(prompt);
      assert.equal(adapter.systemInstruction, prompt);
      const history = adapter.getHistory();
      assert.deepEqual(history.filter(entry => entry.role !== "system"), conversation);
      const systemMessages = history.filter(entry => entry.role === "system");
      assert.equal(systemMessages.length, usesSystemMessage && prompt ? 1 : 0);
      if (usesSystemMessage && prompt) {
        assert.equal(history[0].role, "system");
        assert.equal(history[0].content, prompt);
      }
      assert.equal(adapter.currentModel, "test-model");
      assert.equal(adapter.temperature, 0.3);
    });
    assert.equal(restart.mock.callCount(), 0);
  });
});
