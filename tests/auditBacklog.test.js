import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import ChatManager from "../src/core/chatManager.js";
import CerebrasAdapter from "../src/infrastructure/cerebras/adapter.js";
import FileTools from "../src/tools/fileTools.js";
import { SystemTools } from "../src/tools/systemTools.js";

/** @returns {object} Offline session with the real asynchronous adapter. */
function harness() {
  const errors = [];
  const messages = [];
  const configManager = { get(key, fallback) { return key === "rpm_limit" ? 60000000 : fallback; }, save() {}, setTemporary() {} };
  const ui = {
    inputQueue: [], setBashEnabled(value) { this.bashEnabled = value; },
    setCommandHandler() {}, setRenderingMode() {}, setIdentities(user, model) { this.model = model; },
    displayChatMessage(nick, text) { messages.push([nick, text]); },
    displayError(text) { errors.push(text); }, displayInfo() {},
    startToolMonitoring() {}, endToolMonitoring() {},
    initInput() {}, requestInput() { return null; }, getLogOpenedString() { return "log"; }, close() {},
  };
  const assistant = new CerebrasAdapter({ ui, configManager });
  Object.assign(assistant.client, { /**
                                     * Provides an offline transport response.
                                     * @returns {Promise<object>} Simulated operation result.
                                     */
  get: async () => ({ data: {} }) });
  const payloads = [];
  Object.assign(assistant.client, { /**
                                     * Provides an offline transport response.
                                     * @param {string} _url - Unused request route.
                                     * @param {object} payload - Captured request payload.
                                     * @returns {Promise<object>} Simulated operation result.
                                     */
  post: async (_url, payload) => {
    payloads.push(payload);
    return { data: { choices: [{ message: { content: "answer" } }] } };
  } });
  const manager = new ChatManager({ assistant, ui, configManager, tools: {}, systemInstruction: "POLICY",
    user: { nickname: "human" }, model: { nickname: "bot", name: "fixture", temperature: 0.7 } });
  return { manager, assistant, ui, payloads, errors, messages };
}

["runOnce", "run"].forEach((mode) => {
  test(`A01 ${mode} waits for metadata and includes the first system prompt`, async () => {
    const h = harness();
    const metadata = Promise.withResolvers();
    /**
     * Provides an offline transport response.
     * @returns {Promise<object>} Simulated operation result.
     */
    h.assistant.client.get = () => metadata.promise;
    const running = h.manager[mode]("question");
    await new Promise(resolve => { setImmediate(resolve); });
    assert.equal(h.payloads.length, 0);
    metadata.resolve({ data: { context_length: 8192 } });
    await running;
    assert.equal(h.payloads[0].messages[0].content, "POLICY");
  });

  test(`A01 ${mode} propagates startup rejection without sending`, async () => {
    const h = harness();
    /**
     * Simulates adapter startup.
     * @returns {Promise<void>} Simulated operation result.
     */
    h.assistant.startChat = async () => { throw new Error("startup failure"); };
    await assert.rejects(h.manager[mode]("question"), /startup failure/);
    assert.equal(h.payloads.length, 0);
    assert.equal(h.manager._initialization, null);
  });

  test(`A01 ${mode} exits promptly while metadata remains pending`, async () => {
    const h = harness();
    /** @type {AbortSignal|undefined} */
    let signal;
    /**
     * Provides an offline transport response.
     * @param {string} _url - Unused request route.
     * @param {object} options - Request cancellation options.
     * @returns {Promise<object>} Simulated operation result.
     */
    h.assistant.client.get = (_url, options) => { signal = options.signal; return new Promise(() => {}); };
    const running = h.manager[mode]("question");
    await new Promise(resolve => { setImmediate(resolve); });
    h.manager.requestExit();
    if (mode === "runOnce") await assert.rejects(running, /cancelled/);
    else await running;
    assert.ok(signal);
    assert.equal(signal.aborted, true);
    assert.equal(h.payloads.length, 0);
  });
});

test("A01 synchronous startup and a rejected async startup have an explicit completion contract", async () => {
  const h = harness();
  /**
   * Simulates adapter startup.
   * @returns {void} Simulated operation result.
   */
  h.assistant.startChat = () => { h.assistant.updateSystemInstruction("SYNC"); };
  await h.manager.runOnce("question");
  assert.equal(h.payloads[0].messages[0].content, "SYNC");
});

["success", "failure", "cancel"].forEach((outcome) => {
  test(`A06 overlap preserves active ownership and releases after ${outcome}`, async () => {
    const h = harness();
    await h.manager.initializeSession();
    const pending = Promise.withResolvers();
    /**
     * Provides an offline transport response.
     * @returns {Promise<object>} Simulated operation result.
     */
    h.assistant.client.post = () => pending.promise;
    const first = h.manager.processTurn("first");
    await new Promise(resolve => { setImmediate(resolve); });
    const before = structuredClone(h.assistant.getHistory());
    const { control } = h.manager.turnProcessor;
    await assert.rejects(h.manager.processTurn("second"), /already active/);
    assert.equal(h.manager._turnInProgress, true);
    assert.equal(h.manager.turnProcessor.control, control);
    assert.deepEqual(h.assistant.getHistory(), before);
    await assert.rejects(h.manager.updateSystemContext("changed", {}), /active turn/);
    await assert.rejects(h.manager.setTemperature(0.2), /active turn/);
    assert.equal(await h.manager.rewriteLastTurn("changed"), false);
    if (outcome === "success") {
      pending.resolve({ data: { choices: [{ message: { content: "answer" } }] } });
      await first;
    } else {
      if (outcome === "cancel") h.manager.turnProcessor.cancelPendingTurn();
      pending.reject(new Error("fixture failed"));
      await assert.rejects(first);
    }
    assert.equal(h.manager._turnInProgress, false);
    assert.equal(h.manager.turnProcessor.control, null);
    /**
     * Provides an offline transport response.
     * @returns {Promise<object>} Simulated operation result.
     */
    h.assistant.client.post = async () => ({ data: { choices: [{ message: { content: "next" } }] } });
    await h.manager.processTurn("next");
  });
});

test("A03 literal replacement preserves all dollar forms, Unicode and newlines and rejects ambiguous search", async t => {
  const directory = await fs.mkdtemp(path.join(process.cwd(), "tmp-literal-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const file = path.join(directory, "content.txt");
  const tools = new FileTools();
  const replacement = "$$ $& $` $' café 🦊\nsecond line";
  await fs.writeFile(file, "before TOKEN after");
  await tools.replace(file, "TOKEN", replacement);
  assert.equal(await fs.readFile(file, "utf8"), `before ${replacement} after`);
  const originals = ["absent", "TOKEN TOKEN"];
  for (let index = 0; index < originals.length; index += 1) {
    const original = originals[index];
    await fs.writeFile(file, original);
    await assert.rejects(tools.replace(file, "TOKEN", replacement));
    assert.equal(await fs.readFile(file, "utf8"), original);
  }
});

["", "partial"].forEach((stdout) => {
  [{ code: 7 }, { code: null, signal: "SIGTERM" }, { code: null, signal: "SIGTERM", killed: true }].forEach((state) => {
    test(`A04 execute retains failure with ${JSON.stringify({ stdout, ...state })}`, async () => {
      const system = new SystemTools({ /**
                                        * Simulates a failed subprocess with captured output.
                                        * @returns {Promise<never>} Simulated operation result.
                                        */
      execRunner: async () => { throw Object.assign(new Error("failed"), state, { stdout, stderr: "diagnostic" }); } });
      const h = harness();
      /**
       * Routes shell execution through the real tool.
       * @param {string} command - Shell command.
       * @returns {Promise<string|object>} Simulated operation result.
       */
      h.manager.engine.tools.execute = command => system.execute(command);
      h.ui.bashEnabled = true;
      const result = await h.manager.engine.executeToolCall("execute", { command: "fixture" });
      assert.equal(result.success, false);
      assert.equal(result.outcome.isError, true);
      assert.equal(result.outcome.metadata.exitCode, state.code);
      assert.equal(result.outcome.metadata.signal, state.signal ?? null);
      assert.equal(result.outcome.metadata.timedOut, state.killed === true);
      assert.equal(result.outcome.metadata.stdout, stdout);
      assert.equal(h.manager.engine.toolTracker.outcomes.size, 0);
    });
  });
});

test("A04 real shell nonzero stdout fails and exit zero with stderr succeeds", async () => {
  const system = new SystemTools();
  const result = await system.execute("printf partial; exit 7");
  if (typeof result === "string") throw new Error("Expected failure metadata");
  assert.equal(result.isError, true);
  assert.equal(result.exitCode, 7);
  assert.equal(result.stdout, "partial");
  assert.equal(await system.execute("printf diagnostic >&2"), "diagnostic");
});

["requests", "actions", "errors", "duration", "repetition"].forEach((kind) => {
  test(`A02 failed rewrite restores history and tracking after ${kind} limit`, async () => {
    const h = harness();
    await h.manager.runOnce("original");
    const before = structuredClone(h.assistant.getHistory());
    const original = h.manager._lastTurn;
    h.manager.engine.toolTracker.recordAttempt("read", { path: "earlier" });
    const attempts = structuredClone(h.manager.engine.toolTracker.attempts);
    const repetition = structuredClone(h.manager.repetitionDetector.buffer);
    const limits = { requests: { maxRequests: 1 }, actions: { maxActions: 1 }, errors: { maxErrors: 1 }, duration: { maxDurationMs: 1 }, repetition: {} };
    h.manager.turnProcessor.limits = limits[kind];
    /**
     * Simulates a tool result for the scheduling limit.
     * @returns {Promise<string>} Simulated operation result.
     */
    h.manager.tools.read = async () => "ok";
    if (kind === "errors") /**
                            * Simulates a tool result for the scheduling limit.
                            * @returns {Promise<string>} Simulated operation result.
                            */
    h.manager.tools.read = async () => { throw new Error("read failed"); };
    h.manager.engine.toolTracker.maxAttempts = kind === "repetition" ? 1 : 100;
    /**
     * Allows prose so the test reaches the tool limit.
     * @returns {boolean} Simulated operation result.
     */
    h.manager.repetitionDetector.addText = () => true;
    /**
     * Provides an offline transport response.
     * @returns {Promise<object>} Simulated operation result.
     */
    h.assistant.client.post = async () => {
      if (kind === "duration") await new Promise(resolve => { setTimeout(resolve, 5); });
      return { data: { choices: [{ message: { content: 'Əread("fixture") Əread("fixture")' } }] } };
    };
    await assert.rejects(h.manager.rewriteLastTurn("replacement"), { name: "TurnLimitError" });
    assert.deepEqual(h.assistant.getHistory(), before);
    assert.equal(h.manager._lastTurn, original);
    assert.deepEqual(h.manager.engine.toolTracker.attempts, attempts);
    assert.deepEqual(h.manager.repetitionDetector.buffer, repetition);
    assert.equal(h.manager._turnInProgress, false);
  });
});

test("A01 startup timeout is finite even when an adapter ignores cancellation", async t => {
  const h = harness();
  t.mock.timers.enable({ apis: ["setTimeout"] });
  /** @returns {Promise<void>} Simulates a non-cooperating adapter. */
  h.assistant.startChat = () => new Promise(() => {});
  const running = h.manager.runOnce("question");
  const failed = assert.rejects(running, /startup timed out/);
  await Promise.resolve();
  t.mock.timers.tick(10000);
  await failed;
  assert.equal(h.payloads.length, 0);
  assert.equal(h.manager._initialization, null);
});

test("A02 interactive initial turn limit leaves the next input available", async () => {
  const h = harness();
  h.manager.turnProcessor.limits = { maxRequests: 1 };
  /** @returns {Promise<string>} Supplies the first turn tool result. */
  h.manager.tools.read = async () => "fixture";
  let requests = 0;
  /** @returns {Promise<object>} Stops the first turn, then completes the second. */
  h.assistant.client.post = async () => {
    requests += 1;
    const content = requests === 1 ? 'Əread("fixture")' : "next answer";
    return { data: { choices: [{ message: { content } }] } };
  };
  const input = ["next", null];
  /** @returns {string|null} A new user request, then EOF. */
  h.ui.requestInput = () => input.shift();
  await h.manager.run("initial");
  assert.equal(requests, 2);
  assert.ok(h.errors.some(error => error.includes("request limit")));
  assert.ok(h.messages.some(([nick, text]) => nick === "bot" && text === "next answer"));
});
