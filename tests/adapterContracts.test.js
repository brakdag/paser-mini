import { test } from "node:test";
import assert from "node:assert/strict";
import ProviderManager from "../src/infrastructure/providerManager.js";

const response = {
  choices: [{ message: { content: "Answer" } }],
  candidates: [{ content: { parts: [{ text: "Answer" }] } }],
  message: { content: [{ text: "Answer" }] },
};

new ProviderManager().getProviders().forEach(provider => {
  test(`${provider.id}: local defaults, configured wire payload, roles and reset`, async () => {
    const adapter = await new ProviderManager().createAdapter({
      providerId: provider.id, ui: {}, userNickname: "human", agentNickname: "bot",
      configManager: { get(key, fallback) {
        const values = { rpm_limit: 60000000, compatible_base_url: "http://localhost:9999/v1", model_name: "fixture" };
        return key in values ? values[key] : fallback;
      } },
    });
    assert.equal(adapter.currentModel, provider.id === "COMPATIBLE" ? "fixture" : provider.defaultModel);
    const client = adapter.restClient?.client || adapter.client;
    const requests = [];
    /**
     * Captures requests including provider-specific startup metadata.
     * @param {object} config - Axios request configuration.
     * @returns {Promise<object>} Fake transport response.
     */
    client.defaults.adapter = async config => {
      if (config.method !== "get") requests.push({ url: config.url, body: JSON.parse(config.data) });
      return { config, status: 200, statusText: "OK", headers: {}, data: response };
    };
    adapter.setIdentities({ nickname: "human" }, { nickname: "bot" });
    await adapter.startChat("configured-model", "Policy", 0.25);
    adapter.injectMessage("human", "Earlier question");
    adapter.injectMessage("bot", "Earlier reply");
    assert.equal(await adapter.sendMessage("New question"), "Answer");
    assert.equal(requests.length, 1);
    const { body, url } = requests[0];
    assert.equal(provider.id === "GEMINI" ? body.generationConfig.temperature : body.temperature, 0.25);
    assert.match(JSON.stringify(body), /Policy/);
    assert.match(JSON.stringify(body), /Earlier question.*Earlier reply.*New question/s);
    if (provider.id === "GEMINI") {
      assert.match(url, /configured-model:generateContent/);
      assert.deepEqual(body.contents.map(entry => entry.role), ["user", "model", "user"]);
    } else {
      assert.equal(body.model, "configured-model");
      const messages = body.messages.filter(entry => entry.role !== "system");
      assert.deepEqual(messages.map(entry => entry.role), ["user", "assistant", "user"]);
    }
    adapter.hardReset();
    assert.equal(adapter.getHistory().filter(entry => entry.role !== "system").length, 0);
    assert.equal(adapter.currentModel, "configured-model");
    assert.equal(adapter.temperature, 0.25);
    assert.equal(await adapter.sendMessage("After reset"), "Answer");
    assert.doesNotMatch(JSON.stringify(requests[1].body), /Earlier question|New question/);
    assert.match(JSON.stringify(requests[1].body), /Policy/);
    assert.match(JSON.stringify(requests[1].body), /After reset/);
  });
});

["GROQ", "CEREBRAS", "CLOUDFLARE", "HUGGINGFACE", "OPENROUTER", "ZENMUX", "POOLSIDE"].forEach(providerId => {
  test(`${providerId}: reset normalizes a restored system prompt and owns its history`, async () => {
    const adapter = await new ProviderManager().createAdapter({ providerId, ui: {}, configManager: {} });
    adapter.systemInstruction = "Current policy";
    const restored = [{ role: "system", content: "Old policy" }, { role: "user", content: "Retained" },
      { role: "system", content: "Retained instruction" }];
    const before = structuredClone(restored);
    adapter.hardReset(restored);
    adapter.hardReset(adapter.getHistory());
    assert.deepEqual(adapter.getHistory().map(({ role, content }) => ({ role, content })), [
      { role: "system", content: "Current policy" }, { role: "user", content: "Retained" },
      { role: "system", content: "Retained instruction" },
    ]);
    assert.deepEqual(restored, before);
  });
});
