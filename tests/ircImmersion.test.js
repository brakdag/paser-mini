import { test } from "node:test";
import assert from "node:assert/strict";
import IRCFormatter from "../src/utils/ircFormatter.js";
import ProviderManager from "../src/infrastructure/providerManager.js";

test("IRC reply normalization removes consecutive leading self headers literally", () => {
  const nickname = "Paser.+[ñ]";
  const body = "Hola.\n\n> [12:34] <Paser.+[ñ]> Una cita\n```irc\n[12:35] <Paser.+[ñ]> Código\n```";
  const header = `[12:34] <${nickname}> `;
  [1, 2, 3, 4, 100].forEach(count => {
    assert.equal(IRCFormatter.stripReplyHeaders(header.repeat(count) + body, nickname), body);
  });
  assert.equal(IRCFormatter.stripReplyHeaders(`\n [12:34:56] <${nickname}>\r\n[12:35] <${nickname}> ${body}`, nickname), body);
  assert.equal(IRCFormatter.stripReplyHeaders(header, nickname), "");
});

test("IRC reply normalization preserves quoted/code transcripts, other speakers and body whitespace", () => {
  const texts = [
    "Texto sin encabezado.\n[12:34] <Paser> Una línea interior",
    "> [12:34] <Paser> Una cita",
    "```irc\n[12:34] <Paser> Un ejemplo\n```",
    "    [12:34] <Paser> Código indentado",
    "\t[12:34] <Paser> Código indentado",
    "[12:34] <Usuario> Otro participante",
    "[12:34] <paser> Otro nick",
    "[25:99] <Paser> No es una hora válida",
    "[12:34] <PaserX> Otro nick",
    "  Texto con espacios\n\n",
  ];
  texts.forEach(text => assert.equal(IRCFormatter.stripReplyHeaders(text, "Paser"), text));
  const body = "```irc\n[12:34] <Paser> Ejemplo\n```\n\n";
  assert.equal(IRCFormatter.stripReplyHeaders(`[12:34] <Paser> ${body}`, "Paser"), body);
});

/**
 * Creates one real provider with an offline transport echoing repeated headers.
 * @param {string} providerId - Provider under test.
 * @param {string|null} [rawReply] - Optional unwrapped response to preserve.
 * @returns {Promise<object>} Adapter, captured payloads and response body.
 */
async function fixture(providerId, rawReply = null) {
  const adapter = await new ProviderManager().createAdapter({
    providerId, ui: {},
    configManager: { get(key, fallback) {
      const values = { rpm_limit: 60000000, compatible_base_url: "http://localhost:9999/v1", model_name: "fixture" };
      return key in values ? values[key] : fallback;
    } },
  });
  const body = "Hola.\n> [12:33] <Paser> Una cita";
  const reply = rawReply ?? "[12:34] <Paser> ".repeat(3) + body;
  const requests = [];
  const client = adapter.restClient?.client || adapter.client;
  /**
   * Captures requests and supplies metadata and replies without network access.
   * @param {object} config - Axios request configuration.
   * @returns {Promise<object>} Offline provider response.
   */
  client.defaults.adapter = async config => {
    if (config.method !== "get") requests.push(JSON.parse(config.data));
    return {
      config, status: 200, statusText: "OK", headers: {},
      data: {
        choices: [{ message: { content: reply } }],
        candidates: [{ content: { parts: [{ text: reply }] } }],
        message: { content: [{ text: reply }] },
      },
    };
  };
  adapter.setIdentities({ nickname: "Usuario" }, { nickname: "Paser" });
  await adapter.startChat("test-model", "Policy", 0.7);
  adapter.setRenderingMode("IRC");
  adapter.setImmersionMode(true);
  return { adapter, requests, body, reply };
}

new ProviderManager().getProviders().forEach(({ id }) => {
  test(`${id}: echoed IRC headers never accumulate in history or subsequent immersed requests`, async () => {
    const { adapter, requests, body } = await fixture(id);
    for (let turn = 0; turn < 3; turn += 1) {
      assert.equal(await adapter.sendMessage(`Pregunta ${turn}`), body);
      const history = adapter.getHistory().filter(entry => ["assistant", "model"].includes(entry.role));
      assert.equal(history.length, turn + 1);
      history.forEach(entry => assert.equal(entry.content ?? entry.text ?? entry.parts[0].text, body));
      const payload = requests.at(-1);
      const messages = payload.contents || payload.messages;
      const userMessages = messages.filter(entry => entry.role === "user");
      userMessages.forEach(entry => {
        const text = entry.content ?? entry.parts[0].text;
        assert.match(text, /^\[\d{2}:\d{2}\] <Usuario> Pregunta \d$/);
      });
      const assistantMessages = messages.filter(entry => ["assistant", "model"].includes(entry.role));
      assistantMessages.forEach(entry => {
        const text = entry.content ?? entry.parts[0].text;
        assert.match(text, /^\[\d{2}:\d{2}\] <Paser> Hola\./);
        assert.equal(text.slice(text.indexOf("> ") + 2), body);
      });
    }
  });

  test(`${id}: immersed IRC preserves a quoted or indented transcript in the response and next payload`, async () => {
    const examples = ["    [12:34] <Paser> Código indentado", "```irc\n[12:34] <Paser> Ejemplo\n```", "> [12:34] <Paser> Cita"];
    for (let index = 0; index < examples.length; index += 1) {
      const example = examples[index];
      const { adapter, requests } = await fixture(id, example);
      assert.equal(await adapter.sendMessage("Un ejemplo"), example);
      const history = adapter.getHistory().at(-1);
      assert.equal(history.content ?? history.text ?? history.parts[0].text, example);
      await adapter.sendMessage("Continuar");
      const payload = requests.at(-1);
      const message = (payload.contents || payload.messages).find(entry => ["assistant", "model"].includes(entry.role));
      const text = message.content ?? message.parts[0].text;
      assert.equal(text.slice(text.indexOf("> ") + 2), example);
    }
  });
});

test("old duplicated assistant text is repaired in IRC payloads without stripping user text", async () => {
  const { adapter } = await fixture("GEMINI");
  const doubled = "[12:34] <Paser> [12:35] <Paser> Texto";
  assert.equal(adapter.formatTextForPayload("model", doubled, "13:00"), "[13:00] <Paser> Texto");
  assert.equal(adapter.formatTextForPayload("user", doubled, "13:00"), `[13:00] <Usuario> ${doubled}`);
});

test("non-immersive IRC, CLEAN and Fountain preserve generated text", async () => {
  const { adapter, reply } = await fixture("GEMINI");
  const modes = [{ mode: "IRC", immersion: false }, { mode: "CLEAN", immersion: true }, { mode: "FOUNTAIN", immersion: true }];
  for (let index = 0; index < modes.length; index += 1) {
    const { mode, immersion } = modes[index];
    adapter.setRenderingMode(mode);
    adapter.setImmersionMode(immersion);
    assert.equal(await adapter.sendMessage("Pregunta"), reply);
    assert.equal(adapter.getHistory().at(-1).parts[0].text, reply);
  }
});
