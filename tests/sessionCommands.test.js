import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import ChatManager from "../src/core/chatManager.js";
import SessionCommands from "../src/core/commandHandlers/session.js";
import GeminiAdapter from "../src/infrastructure/gemini/adapter.js";
import { UserInterruptException } from "../src/core/exceptions.js";
import promptManager, { SystemPromptManager } from "../src/core/systemPromptManager.js";
import mcpManager from "../src/infrastructure/McpManager.js";
import { SystemTools } from "../src/tools/systemTools.js";

/**
 * Creates an offline session with the real turn processor and Gemini history.
 * @param {object} t - The test context.
 * @param {object} [options] - Session options to override.
 * @returns {object} The session and captured UI/HTTP events.
 */
function harness(t, options = {}) {
  const errors = [];
  const messages = [];
  const payloads = [];
  const answers = [];
  const configManager = {
    get(key, fallback) { return key === "rpm_limit" ? 60000000 : fallback; },
    save() {},
  };
  const ui = {
    setBashEnabled(enabled) { this.bashEnabled = enabled; },
    setCommandHandler() {},
    setRenderingMode() {},
    setIdentities(_user, model) { this.model = model; },
    displayError(message) { errors.push(message); },
    displayInfo() {},
    displayChatMessage(nick, message) { messages.push({ nick, message }); },
    displayMessage(message) { messages.push({ message }); },
    startToolMonitoring() {},
    endToolMonitoring() {},
  };
  const assistant = new GeminiAdapter({ ui, configManager });
  assistant.retryHandler.maxRetries = 1;
  t.mock.method(assistant.client, "post", async (_url, payload) => {
    payloads.push(structuredClone(payload));
    const answer = answers.shift();
    if (answer instanceof Error) throw answer;
    assert.equal(typeof answer, "string", "Every request needs an explicit offline response");
    return { data: { candidates: [{ content: { parts: [{ text: answer }] } }] } };
  });
  const manager = new ChatManager({
    assistant, ui, configManager, tools: {}, systemInstruction: "Test system",
    user: { nickname: "user" },
    model: { nickname: "agent", name: "test-model", temperature: 0.7 },
    ...options,
  });
  assistant.startChat(manager.model.name, manager.systemInstruction);
  return { manager, assistant, errors, messages, payloads, answers };
}

test("/help and /config describe actual reset and context behavior", async (t) => {
  const h = harness(t);
  const panels = [];
  Object.assign(h.manager.ui, {
    displayInfoPanel(title, rows) { panels.push({ title, rows }); },
  });
  assert.equal(await h.manager.commandHandler.handle("/help"), true);
  const help = JSON.stringify(panels[0].rows);
  ["/reload", "/connect", "/execute", "/trunc", "/true", "/sp", "/c", "/mchk"].forEach(command => {
    assert.ok(help.includes(command), command);
  });
  assert.doesNotMatch(help, /Bridge Block/);
  assert.equal(await h.manager.commandHandler.handle("/config"), true);
  const config = JSON.stringify(panels[1].rows);
  assert.match(config, /Estimated Token Usage/);
  assert.match(config, /provider limits still apply/);
  assert.doesNotMatch(config, /Infinite|Instance Timeout/);
});

["/fav +", "/fav+"].forEach(command => {
  test(`${command} saves the current model temperature`, async (t) => {
    const h = harness(t);
    const saves = [];
    t.mock.method(h.manager.configManager, "save", (key, value) => saves.push({ key, value }));
    assert.equal(await h.manager.commandHandler.handle(command), true);
    assert.deepEqual(saves, [{ key: "favorites", value: [{ provider: "GEMINI", model: "test-model", temp: 0.7 }] }]);
  });
});

test("command prefixes require a word boundary", async (t) => {
  const h = harness(t);
  const commands = ["/modelsExtra", "/favorite", "/connected"];
  for (let i = 0; i < commands.length; i += 1) {
    assert.equal(await h.manager.commandHandler.handle(commands[i]), true);
    assert.match(h.errors.at(-1), /Invalid command/);
  }
  const errorsBefore = h.errors.length;
  assert.equal(await h.manager.commandHandler.handle("/fav\t+"), true);
  assert.equal(h.errors.length, errorsBefore);
  assert.equal(h.payloads.length, 0);
});

test("/s without arguments saves the last payload to its documented default", async (t) => {
  const h = harness(t);
  h.assistant.lastPayload = { contents: [] };
  const writes = [];
  t.mock.method(fs, "writeFile", async (...args) => { writes.push(args); });
  assert.equal(await h.manager.commandHandler.handle("/s"), true);
  assert.equal(writes[0][0], "last_request.json");
  assert.deepEqual(JSON.parse(writes[0][1]), { contents: [] });
});

test("/trunc accepts whole budgets once and describes them as estimates", async (t) => {
  const h = harness(t);
  const saves = [];
  const info = [];
  t.mock.method(h.manager.configManager, "save", (key, value) => saves.push({ key, value }));
  t.mock.method(h.manager.ui, "displayInfo", message => info.push(message));
  const invalid = ["12x", "-1", "1.5", "Infinity"];
  for (let i = 0; i < invalid.length; i += 1) {
    await h.manager.commandHandler.handle(`/trunc ${invalid[i]}`);
  }
  assert.equal(saves.length, 0);
  await h.manager.commandHandler.handle("/trunc 8000");
  assert.deepEqual(saves, [{ key: "context_window_limit", value: 8000 }]);
  assert.match(info.at(-1), /Approximate complete-turn budget/);
  await h.manager.commandHandler.handle("/trunc 0");
  assert.match(info.at(-1), /Provider context limits still apply/);
});

["/reload", "/cache"].forEach((command) => {
  test(`${command} rereads the role file and updates tools without clearing history`, async (t) => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "paser-reload-"));
    t.after(() => fs.rm(dir, { recursive: true, force: true }));
    t.mock.method(mcpManager, "initialize", async () => {});
    t.mock.method(mcpManager, "getTools", () => ({}));
    t.mock.method(mcpManager, "getSchemas", () => ({}));
    const file = path.join(dir, "role.txt");
    await fs.writeFile(file, 'Original role\nTOOLS_AVAILABLE = ["read"]');
    const builder = new SystemPromptManager({ cacheDir: path.join(dir, "cache") });
    const initial = await builder.buildPrompt({ fileSystemInstruction: file });
    builder.saveCache();
    const h = harness(t, { systemInstruction: initial.systemInstruction, tools: initial.filteredTools });
    h.assistant.injectMessage("user", "Existing conversation");
    const history = structuredClone(h.assistant.getHistory());
    t.mock.method(promptManager, "rebuildCache", () => builder.rebuildCache());
    t.mock.method(promptManager, "saveCache", () => builder.saveCache());
    await fs.writeFile(file, 'Updated role\nTOOLS_AVAILABLE = ["write"]');

    assert.equal(await h.manager.commandHandler.handle(`  ${command.toUpperCase()}  `), true);
    assert.match(h.manager.systemInstruction, /Updated role/);
    assert.doesNotMatch(h.manager.systemInstruction, /Original role/);
    assert.deepEqual(Object.keys(h.manager.tools), ["write"]);
    assert.equal(h.manager.engine.tools, h.manager.tools);
    assert.equal(h.manager.turnProcessor.tools, h.manager.tools);
    assert.deepEqual(h.assistant.getHistory(), history);
    assert.equal(h.errors.length, 0);
    const cache = JSON.parse(await fs.readFile(builder.cacheFile, "utf8"));
    assert.equal(cache.systemInstruction, h.manager.systemInstruction);
    assert.deepEqual(cache.filteredToolNames, ["write"]);
    h.answers.push("Continued answer");
    await h.manager.processTurn("Continue");
    assert.match(JSON.stringify(h.payloads[0].systemInstruction), /Updated role/);
  });

  test(`${command} reports a rebuild failure and permits a later retry`, async (t) => {
    const h = harness(t);
    h.assistant.injectMessage("user", "Existing conversation");
    const history = structuredClone(h.assistant.getHistory());
    const { tools } = h.manager;
    const rebuild = t.mock.method(promptManager, "rebuildCache", async () => {
      throw new Error("Cannot read role file");
    });
    const save = t.mock.method(promptManager, "saveCache", () => {});
    assert.equal(await h.manager.commandHandler.handle(command), true);
    assert.match(h.errors.at(-1), /Failed to rebuild cache: Cannot read role file/);
    assert.equal(h.manager.systemInstruction, "Test system");
    assert.equal(h.manager.tools, tools);
    assert.equal(save.mock.callCount(), 0);
    assert.deepEqual(h.assistant.getHistory(), history);
    rebuild.mock.mockImplementation(async () => ({
      systemInstruction: "Recovered prompt", filteredTools: {}, pureMode: false,
    }));
    assert.equal(await h.manager.commandHandler.handle(command), true);
    assert.equal(h.manager.systemInstruction, "Recovered prompt");
    assert.equal(save.mock.callCount(), 1);
    h.answers.push("Continued answer");
    await h.manager.processTurn("Continue");
    assert.equal(h.payloads.length, 1);
  });
});

test("/rewrite and /r replace the latest simple turn and preserve earlier history", async (t) => {
  const h = harness(t);
  h.answers.push("First answer", "Old answer", "Replacement", "Another replacement");
  await h.manager.processTurn("First question");
  const earlier = structuredClone(h.assistant.getHistory());
  await h.manager.processTurn("Old question");
  assert.equal(await h.manager.commandHandler.handle("/rewrite New question"), true);
  assert.equal(h.assistant.getHistory().length, earlier.length + 2);
  assert.deepEqual(h.assistant.getHistory().slice(0, earlier.length), earlier);
  assert.equal(h.assistant.getHistory().at(-2).parts[0].text, "New question");
  assert.equal(h.assistant.getHistory().at(-1).parts[0].text, "Replacement");
  assert.equal(await h.manager.commandHandler.handle("/r Another question"), true);
  assert.equal(h.assistant.getHistory().length, earlier.length + 2);
  assert.equal(h.assistant.getHistory().at(-2).parts[0].text, "Another question");
  assert.equal(h.assistant.getHistory().at(-1).parts[0].text, "Another replacement");
});

test("rewrite removes every tool exchange in the turn", async (t) => {
  const h = harness(t, { tools: { async read() { return "Fixture contents"; } } });
  h.answers.push("Earlier answer", 'Əread("fixture.txt")', 'Əread("second.txt")', "Final answer", "New answer");
  await h.manager.processTurn("Earlier question");
  const earlier = structuredClone(h.assistant.getHistory());
  await h.manager.processTurn("Question with tools");
  assert.equal(h.assistant.getHistory().length, earlier.length + 6);
  const turnIds = h.assistant.getHistory().slice(earlier.length).map(message => message.contextTurn);
  assert.ok(turnIds.every(Boolean));
  assert.equal(new Set(turnIds).size, 1);
  await SessionCommands.handleRewrite(h.manager, h.manager.ui, "Replacement question");
  assert.deepEqual(h.assistant.getHistory().slice(0, earlier.length), earlier);
  assert.equal(h.assistant.getHistory().length, earlier.length + 2);
  assert.deepEqual(h.payloads.at(-1).contents.map((entry) => entry.parts[0].text),
    ["Earlier question", "Earlier answer", "Replacement question"]);
});

[new Error("Transport failed"), new UserInterruptException("Cancelled")].forEach((failure) => {
  test(`failed rewrite restores history and permits another rewrite: ${failure.name}`, async (t) => {
    const h = harness(t, { tools: { async read() { return "Fixture contents"; } } });
    h.answers.push("Old answer", 'Əread("fixture.txt")', failure, "Successful replacement");
    await h.manager.processTurn("Old question");
    const before = structuredClone(h.assistant.getHistory());
    const repetitionBefore = structuredClone(h.manager.repetitionDetector.buffer);
    await assert.rejects(SessionCommands.handleRewrite(h.manager, h.manager.ui, "Failed replacement"),
      (error) => error === failure || error.cause === failure);
    assert.deepEqual(h.assistant.getHistory(), before);
    assert.deepEqual(h.manager.repetitionDetector.buffer, repetitionBefore);
    await SessionCommands.handleRewrite(h.manager, h.manager.ui, "Successful question");
    assert.equal(h.assistant.getHistory().length, 2);
    assert.equal(h.assistant.getHistory().at(-2).parts[0].text, "Successful question");
  });
});

test("rewrite restores nested history even if context preparation mutates and removes entries", async (t) => {
  const h = harness(t);
  h.answers.push("Earlier answer", "Old answer");
  await h.manager.processTurn("Earlier question");
  await h.manager.processTurn("Old question");
  const before = structuredClone(h.assistant.getHistory());
  const failure = new Error("Context preparation failed");
  t.mock.method(h.assistant, "_enforceContextLimit", () => {
    h.assistant.getHistory()[0].parts[0].text = "Mutated";
    h.assistant.getHistory().shift();
    throw failure;
  });
  await assert.rejects(SessionCommands.handleRewrite(h.manager, h.manager.ui, "New question"), (error) => error === failure);
  assert.deepEqual(h.assistant.getHistory(), before);
});

test("rewrite retains the prior turn even when a successful send prunes context", async (t) => {
  const h = harness(t);
  h.answers.push("Earlier answer", "Old answer", "New answer");
  await h.manager.processTurn("Earlier question");
  const earlier = structuredClone(h.assistant.getHistory());
  const enforce = t.mock.method(h.assistant, "_enforceContextLimit", () => {
    h.assistant.getHistory().splice(0, 2);
  });
  await h.manager.processTurn("Old question");
  enforce.mock.restore();
  await SessionCommands.handleRewrite(h.manager, h.manager.ui, "New question");
  assert.deepEqual(h.assistant.getHistory().slice(0, earlier.length), earlier);
});

["", "   "].forEach((input) => {
  test(`rewrite refuses empty input ${JSON.stringify(input)} without changing history`, async (t) => {
    const h = harness(t);
    h.answers.push("Answer");
    await h.manager.processTurn("Question");
    const before = structuredClone(h.assistant.getHistory());
    await SessionCommands.handleRewrite(h.manager, h.manager.ui, input);
    assert.deepEqual(h.assistant.getHistory(), before);
    assert.equal(h.payloads.length, 1);
    assert.match(h.errors.at(-1), /[Uu]sage/);
  });
});

test("rewrite refuses untracked or externally changed history", async (t) => {
  const h = harness(t);
  h.assistant.injectMessage("user", "Imported question");
  h.assistant.injectMessage("model", "Imported answer");
  let before = structuredClone(h.assistant.getHistory());
  await SessionCommands.handleRewrite(h.manager, h.manager.ui, "New question");
  assert.deepEqual(h.assistant.getHistory(), before);
  assert.equal(h.payloads.length, 0);
  h.answers.push("Answer");
  await h.manager.processTurn("Tracked question");
  h.assistant.getHistory().at(-1).parts[0].text = "Manually changed";
  before = structuredClone(h.assistant.getHistory());
  await SessionCommands.handleRewrite(h.manager, h.manager.ui, "New question");
  assert.deepEqual(h.assistant.getHistory(), before);
  assert.equal(h.payloads.length, 1);
  assert.equal(h.errors.length, 2);
});

test("rewrite preserves system messages in adapters storing content and timestamps", async (t) => {
  const h = harness(t);
  const history = [{ role: "system", content: "System", timestamp: "initial" }];
  const assistant = { getHistory() { return history; } };
  h.manager.assistant = assistant;
  t.mock.method(h.manager.turnProcessor, "process", async (input) => {
    history.push({ role: "user", content: input, timestamp: "question" });
    history.push({ role: "assistant", content: "Answer", timestamp: "answer" });
  });
  await h.manager.processTurn("Old question");
  await SessionCommands.handleRewrite(h.manager, h.manager.ui, "New question");
  assert.deepEqual(history, [
    { role: "system", content: "System", timestamp: "initial" },
    { role: "user", content: "New question", timestamp: "question" },
    { role: "assistant", content: "Answer", timestamp: "answer" },
  ]);
});

test("an empty ordinary turn does not replace the rewrite target", async (t) => {
  const h = harness(t);
  h.answers.push("Old answer", "New answer");
  await h.manager.processTurn("Old question");
  await h.manager.processTurn("");
  await SessionCommands.handleRewrite(h.manager, h.manager.ui, "New question");
  assert.equal(h.assistant.getHistory().length, 2);
  assert.equal(h.assistant.getHistory()[0].parts[0].text, "New question");
});

test("pure mode displays literal tool syntax without executing tools or requesting results", async (t) => {
  let executions = 0;
  const h = harness(t, {
    pureMode: true, systemInstruction: "",
    tools: { async read() { executions += 1; return "Should not run"; } },
  });
  const text = 'Literal code: Əread("fixture.txt")';
  h.answers.push(text);
  await h.manager.processTurn("Show an example");
  assert.equal(h.manager.engine.strictPureMode, true);
  assert.equal(executions, 0);
  assert.equal(h.payloads.length, 1);
  assert.equal(h.messages.at(-1).message, text);
});

test("an empty prompt allows tools unless pure mode is explicitly enabled", async (t) => {
  const h = harness(t, { systemInstruction: "" });
  assert.equal(h.manager.engine.strictPureMode, false);
});

[false, true].forEach(pureMode => {
  test(`/run shares literal shell input and output with the AI without agent shell access (pure=${pureMode})`, async t => {
    const h = harness(t, { pureMode });
    const command = 'printf "%s" "a $HOME" | cat';
    const shell = t.mock.method(SystemTools.prototype, "execute", async () => "Console output\nwarning");
    h.answers.push("Try the next command yourself.");
    assert.equal(await h.manager.commandHandler.handle(`/RUN\t${command}`), true);
    assert.equal(shell.mock.calls[0].arguments[0], command);
    assert.deepEqual(shell.mock.calls[0].arguments[1], { loginShell: true });
    assert.equal(h.manager.ui.bashEnabled, false);
    assert.equal(h.manager.engine.tools.execute, undefined);
    assert.match(h.messages.find(entry => entry.message.includes("Shell Output")).message, /Console output\nwarning/);
    const request = JSON.stringify(h.payloads[0]);
    assert.ok(request.includes(JSON.stringify(command).slice(1, -1)));
    assert.match(request, /Console output/);
    assert.match(request, /Do not execute more commands/);
    assert.match(request, /✓ OK/);
    assert.equal(h.payloads.length, 1);
  });
});

test("/run records command failures and preserves output if AI guidance fails", async t => {
  const h = harness(t);
  t.mock.method(SystemTools.prototype, "execute", async () => ({
    isError: true, content: [{ type: "text", text: "command not found" }], exitCode: 127,
  }));
  h.answers.push(new Error("Provider unavailable"));
  await assert.rejects(h.manager.commandHandler.handle("/run missing-command"), /Provider unavailable/);
  assert.match(JSON.stringify(h.assistant.getHistory()), /missing-command/);
  assert.match(JSON.stringify(h.assistant.getHistory()), /command not found/);
  assert.match(JSON.stringify(h.assistant.getHistory()), /127/);
  assert.match(JSON.stringify(h.assistant.getHistory()), /ERROR/);
  assert.ok(h.messages.some(entry => entry.message.includes("command not found")));
});

test("/run without input reports usage and never launches a shell or AI request", async t => {
  const h = harness(t);
  const shell = t.mock.method(SystemTools.prototype, "execute", async () => "unused");
  assert.equal(await h.manager.commandHandler.handle("/run   "), true);
  assert.match(h.errors.at(-1), /Usage: \/run/);
  assert.equal(shell.mock.callCount(), 0);
  assert.equal(h.payloads.length, 0);
  await h.manager.commandHandler.handle("/runner");
  assert.match(h.errors.at(-1), /Invalid command/);
});

test("/tool shares calls, status and media with the next AI request without requesting a reply", async t => {
  const image = { type: "image", mimeType: "image/png", data: "YWJj" };
  const h = harness(t, { tools: { async read() {
    return { isError: true, content: [{ type: "text", text: "Partial result" }, image], exitCode: 1 };
  } } });
  await h.manager.commandHandler.handle('/tool read("fixture.txt")');
  assert.equal(h.payloads.length, 0);
  const history = JSON.stringify(h.assistant.getHistory());
  assert.match(history, /fixture.txt/);
  assert.match(history, /Partial result/);
  assert.match(history, /ERROR/);
  assert.match(history, /YWJj/);
  h.answers.push("Explanation");
  await h.manager.processTurn("Explain that result");
  assert.match(JSON.stringify(h.payloads[0]), /Partial result/);
  assert.match(JSON.stringify(h.payloads[0]), /YWJj/);
});

test("immersed IRC strips echoed headers before parsing tools and storing their exchanges", async t => {
  let executions = 0;
  const h = harness(t, { tools: { async read() { executions += 1; return "Contents"; } } });
  await h.manager.initializeSession();
  h.manager.setImmersionMode(true);
  h.answers.push('[12:34] <agent> [12:34] <agent> Əread("fixture.txt")', "[12:35] <agent> Final answer");
  await h.manager.processTurn("Question");
  assert.equal(executions, 1);
  assert.equal(h.messages.at(-1).message, "Final answer");
  assert.equal(h.assistant.getHistory()[1].parts[0].text, 'Əread("fixture.txt")');
  assert.equal(h.assistant.getHistory().at(-1).parts[0].text, "Final answer");
  assert.match(h.payloads[1].contents[1].parts[0].text, /^\[\d{2}:\d{2}\] <agent> Əread/);
});

test("context updates use the explicit mode and retain it when omitted", async (t) => {
  let executions = 0;
  const tools = { async read() { executions += 1; return "Contents"; } };
  const h = harness(t);
  await h.manager.updateSystemContext("Custom prompt", tools, true);
  assert.equal(h.manager.engine.strictPureMode, true);
  assert.equal((await h.manager.engine.executeToolCall("read", { path: "fixture.txt" })).success, false);
  assert.equal(executions, 0);
  await h.manager.updateSystemContext("", tools);
  assert.equal(h.manager.engine.strictPureMode, true);
  await h.manager.updateSystemContext("", tools, false);
  assert.equal((await h.manager.engine.executeToolCall("read", { path: "fixture.txt" })).success, true);
  assert.equal(executions, 1);
});

["/rewrite", "/r", "/REWRITE   "].forEach((command) => {
  test(`${JSON.stringify(command)} reports usage without sending a request`, async (t) => {
    const h = harness(t);
    assert.equal(await h.manager.commandHandler.handle(command), true);
    assert.match(h.errors.at(-1), /[Uu]sage/);
    assert.equal(h.payloads.length, 0);
  });
});

test("rewrite refuses to change history during an active turn", async (t) => {
  const h = harness(t);
  h.answers.push("Old answer");
  await h.manager.processTurn("Old question");
  let finish;
  t.mock.method(h.manager.turnProcessor, "process", () => new Promise((resolve) => { finish = resolve; }));
  const running = h.manager.processTurn("Active question");
  const before = structuredClone(h.assistant.getHistory());
  await SessionCommands.handleRewrite(h.manager, h.manager.ui, "Replacement question");
  assert.deepEqual(h.assistant.getHistory(), before);
  assert.match(h.errors.at(-1), /active turn/);
  finish();
  await running;
});

test("rewrite refuses a reset or replacement adapter even if its history matches", async (t) => {
  const h = harness(t);
  h.answers.push("Old answer");
  await h.manager.processTurn("Old question");
  const before = structuredClone(h.assistant.getHistory());
  h.manager.assistant = { getHistory() { return before; } };
  await SessionCommands.handleRewrite(h.manager, h.manager.ui, "Replacement question");
  assert.deepEqual(h.assistant.getHistory(), before);
  assert.equal(h.payloads.length, 1);
  h.manager.assistant = h.assistant;
  h.assistant.hardReset();
  await SessionCommands.handleRewrite(h.manager, h.manager.ui, "Replacement question");
  assert.deepEqual(h.assistant.getHistory(), []);
  assert.equal(h.payloads.length, 1);
  assert.equal(h.errors.length, 2);
});
