import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import TerminalUI from "../src/core/terminalUI.js";
import ConfigManager from "../src/core/configManager.js";
import createSession from "../src/core/sessionFactory.js";
import GeminiAdapter from "../src/infrastructure/gemini/adapter.js";

/**
 * Builds a terminal session with persisted identities and an offline provider.
 * @param {object} t - Test context owning mocks and temporary storage.
 * @param {string} mode - Rendering mode.
 * @param {boolean} immersion - Whether payloads include formatted identities.
 * @param {string} [reply] - Offline provider response.
 * @returns {Promise<object>} Session, terminal output, log entries and payloads.
 */
async function fixture(t, mode, immersion, reply = "Respuesta") {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "paser-nicknames-"));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const globalDir = path.join(dir, "home");
  const configManager = new ConfigManager({ globalDir, localDir: path.join(dir, "project-a") });
  configManager.save("user_nickname", "Lucía");
  configManager.save("agent_nickname", "Paser");
  configManager.save("rendering_mode", mode);
  configManager.save("immersion_mode", immersion);
  configManager.save("rpm_limit", 60000000);
  const ui = new TerminalUI();
  const output = [];
  const logs = [];
  const payloads = [];
  t.mock.method(process.stdout, "write", chunk => { output.push(String(chunk)); return true; });
  t.mock.method(ui, "writeToLog", text => { logs.push(text); });
  const assistant = new GeminiAdapter({ ui, configManager });
  t.mock.method(assistant.client, "post", async (_url, payload) => {
    payloads.push(structuredClone(payload));
    return { data: { candidates: [{ content: { parts: [{ text: reply }] } }] } };
  });
  const providerManager = {
    getProviders() { return [{ id: "GEMINI", defaultModel: "test-model" }]; },
    async createAdapter() { return assistant; },
  };
  const manager = await createSession({
    ui, configManager, providerManager, tools: {}, systemInstruction: "", pureMode: true,
  });
  manager.initializeSession();
  return { manager, assistant, ui, output, logs, payloads, dir, globalDir, providerManager };
}

["IRC", "FOUNTAIN", "CLEAN"].forEach(mode => {
  [false, true].forEach(immersion => {
    test(`${mode}, immersion ${immersion}: /ping and /me keep persisted names in terminal, log and payload`, async t => {
      const h = await fixture(t, mode, immersion);
      await h.manager.commandHandler.handle('/ping "Hola"');
      await h.manager.commandHandler.handle("/me saluda");
      assert.match(h.output.join(""), /<Lucía>/u);
      assert.match(h.logs[0], mode === "FOUNTAIN" ? /LUCÍA/u : /<Lucía>/u);
      assert.match(h.logs.find(entry => entry.includes("saluda")), mode === "FOUNTAIN" ? /LUCÍA/u : /<Lucía>/u);
      assert.doesNotMatch(h.output.join("") + h.logs.join(""), /undefined/);
      assert.equal(h.assistant.getHistory()[0].parts[0].text, '"Hola"');
      assert.equal(h.assistant.getHistory()[2].parts[0].text, "* saluda *");
      const userText = h.payloads[0].contents[0].parts[0].text;
      if (immersion && mode !== "CLEAN") {
        assert.match(userText, mode === "FOUNTAIN" ? /LUCÍA/u : /<Lucía>/u);
      } else {
        assert.equal(userText, '"Hola"');
      }
      assert.doesNotMatch(JSON.stringify(h.payloads), /undefined/);
    });

    test(`${mode}, immersion ${immersion}: /paim stores raw agent text and formats its identity once`, async t => {
      const h = await fixture(t, mode, immersion);
      await h.manager.commandHandler.handle("/paim Mensaje inyectado");
      assert.match(h.output.join(""), /<Paser>/);
      assert.match(h.logs[0], mode === "FOUNTAIN" ? /PASER/ : /<Paser>/);
      assert.equal(h.assistant.getHistory()[0].role, "model");
      assert.equal(h.assistant.getHistory()[0].parts[0].text, "Mensaje inyectado");
      await h.manager.commandHandler.handle("/ping Continuar");
      const agentText = h.payloads[0].contents[0].parts[0].text;
      if (immersion && mode !== "CLEAN") {
        const names = agentText.match(mode === "FOUNTAIN" ? /PASER/g : /<Paser>/g);
        assert.equal(names.length, 1);
      } else {
        assert.equal(agentText, "Mensaje inyectado");
      }
      assert.doesNotMatch(h.logs.join("") + JSON.stringify(h.payloads), /undefined/);
    });
  });
});

test("/nick persists globally and a session in another project uses it immediately", async t => {
  const h = await fixture(t, "IRC", true);
  await h.manager.commandHandler.handle("/nick Gustavo");
  await h.manager.commandHandler.handle("/ping Primera sesión");
  assert.equal(h.ui.user.nickname, "Gustavo");
  assert.match(h.logs.find(entry => entry.includes("Primera sesión")), /<Gustavo>/);
  assert.match(h.payloads[0].contents[0].parts[0].text, /<Gustavo>/);
  const configManager = new ConfigManager({ globalDir: h.globalDir, localDir: path.join(h.dir, "project-b") });
  const ui = new TerminalUI();
  const messages = [];
  t.mock.method(ui, "writeToLog", text => { messages.push(text); });
  const manager = await createSession({
    ui, configManager, providerManager: h.providerManager, tools: {}, systemInstruction: "", pureMode: true,
  });
  manager.initializeSession();
  await manager.commandHandler.handle("/ping Otro proyecto");
  assert.equal(manager.user.nickname, "Gustavo");
  assert.equal(manager.model.nickname, "Paser");
  assert.match(messages[0], /<Gustavo>/);
  assert.match(messages[1], /<Paser>/);
});

test("terminal nickname setters update the shared identities", () => {
  const ui = new TerminalUI();
  const user = { nickname: "old-user" };
  const model = { nickname: "old-agent" };
  ui.setIdentities(user, model);
  ui.setUserNickname("new-user");
  ui.setAgentNickname("new-agent");
  assert.equal(user.nickname, "new-user");
  assert.equal(model.nickname, "new-agent");
});

test("immersed IRC displays and logs exactly one header while retaining formatted model context", async t => {
  const h = await fixture(t, "IRC", true, `${"[12:34] <Paser> ".repeat(3)}Una respuesta`);
  for (let turn = 0; turn < 3; turn += 1) {
    await h.manager.commandHandler.handle(`/ping Pregunta ${turn}`);
  }
  const answers = h.logs.filter(entry => entry.includes("Una respuesta"));
  assert.equal(answers.length, 3);
  answers.forEach(entry => assert.match(entry, /^\[\d{2}:\d{2}\] <Paser> Una respuesta$/));
  assert.equal(h.output.join("").match(/<Paser>/g).length, 3);
  assert.equal(h.assistant.getHistory().at(-1).parts[0].text, "Una respuesta");
  assert.match(h.payloads.at(-1).contents[1].parts[0].text, /^\[\d{2}:\d{2}\] <Paser> Una respuesta$/);
});
