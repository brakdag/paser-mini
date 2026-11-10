import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { Readable, PassThrough, Writable } from "node:stream";
import { spawn } from "node:child_process";
import readline from "node:readline";
import { TerminalInput } from "../src/core/TerminalInput.js";
import readPipelineInput from "../src/core/pipeline.js";
import PipelineUI from "../src/core/pipelineUI.js";
import CompatibleAdapter from "../src/infrastructure/compatible/adapter.js";
import readChatStream from "../src/infrastructure/chatStream.js";
import ChatManager from "../src/core/chatManager.js";
import CommandHandler from "../src/core/commandHandler.js";

/**
 * @param {object} [values] - Configuration overrides.
 * @param {object} [ui] - UI observer.
 * @returns {CompatibleAdapter} Offline configurable adapter.
 */
function adapter(values = {}, ui = {}) {
  const config = { compatible_base_url: "http://localhost:9999/prefix/v1", model_name: "fixture", rpm_limit: 60000000, ...values };
  const result = new CompatibleAdapter({ ui, configManager: { get(key, fallback) { return key in config ? config[key] : fallback; } } });
  result.retryHandler.maxRetries = 1;
  result.startChat(config.model_name, "POLICY");
  return result;
}

/**
 * @param {string} content - Text delta.
 * @returns {string} SSE event.
 */
const delta = content => `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`;

test("F01 reads stdin as one literal Unicode document and rejects empty input", async () => {
  const source = "/quit\nmañana 🦊\n";
  const bytes = Buffer.from(source);
  const chunks = Array.from(bytes, value => Buffer.from([value]));
  assert.equal(await readPipelineInput(Readable.from(chunks), "Summarize"), `Summarize\n\n${source}`);
  assert.equal(await readPipelineInput(Readable.from([bytes])), source);
  await assert.rejects(readPipelineInput(Readable.from([" \n"])), /empty/);
});

test("F01 pipeline separates diagnostics and publishes only a completed response", async () => {
  const output = new PassThrough();
  const diagnostic = new PassThrough();
  let stdout = "";
  let stderr = "";
  output.on("data", chunk => { stdout += chunk; });
  diagnostic.on("data", chunk => { stderr += chunk; });
  const ui = new PipelineUI({ output, diagnostic });
  ui.displayInfo("info");
  ui.displayError("error");
  ui.displayRawMessage("tool");
  ui.previewResponse("partial");
  ui.displayChatMessage(ui.model.nickname, "answer 🦊");
  assert.equal(stdout, "");
  await ui.publish();
  assert.equal(stdout, "answer 🦊\n");
  assert.equal(stderr, "info\nerror\ntool\n");
  ui.close();
});

test("F01 a closed output pipe rejects publication", async () => {
  const output = new Writable({ write(_chunk, _encoding, callback) { callback(Object.assign(new Error("closed"), { code: "EPIPE" })); } });
  const ui = new PipelineUI({ output, diagnostic: new PassThrough() });
  await assert.rejects(ui.publish(), { code: "EPIPE" });
  ui.close();
});

/** @type {Array<[string, string, boolean]>} */
const endpoints = [["http://localhost:9999/v1", "local", false], ["https://fixture.invalid/prefix/v1/", "remote", true]];
endpoints.forEach(([url, model, authenticated]) => {
  test(`F02 configurable URL/model/auth: ${model}`, async t => {
    const oldKey = process.env.PASER_FIXTURE_KEY;
    process.env.PASER_FIXTURE_KEY = "fixture-secret";
    t.after(() => { if (oldKey === undefined) delete process.env.PASER_FIXTURE_KEY; else process.env.PASER_FIXTURE_KEY = oldKey; });
    const a = adapter({ compatible_base_url: url, model_name: model, ...(authenticated ? { compatible_api_key_env: "PASER_FIXTURE_KEY" } : {}) });
    const requests = [];
    /**
     * Provides an offline transport response.
     * @param {import("axios").InternalAxiosRequestConfig} config - Axios request configuration.
     * @returns {Promise<import("axios").AxiosResponse>} Simulated operation result.
     */
    a.client.defaults.adapter = async config => {
      requests.push({ url: a.client.getUri(config), payload: JSON.parse(config.data), auth: config.headers.Authorization });
      return { status: 200, statusText: "OK", config, headers: {}, data: { choices: [{ message: { content: "answer" } }] } };
    };
    assert.equal(await a.sendMessage("question"), "answer");
    assert.equal(requests[0].url, `${url.replace(/\/$/, "")}/chat/completions`);
    assert.equal(requests[0].payload.model, model);
    assert.equal(requests[0].auth, authenticated ? "Bearer fixture-secret" : undefined);
    assert.equal(requests[0].payload.messages[0].content, "POLICY");
    assert.doesNotMatch(JSON.stringify(a.lastPayload), /fixture-secret/);
  });
});

[
  { compatible_base_url: "bad" }, { compatible_base_url: "file:///tmp/a" },
  { compatible_base_url: "https://user:secret@example.org/v1" }, { model_name: "" },
  { compatible_api_key_env: "bad name" }, { compatible_api_key_env: "PASER_NONEXISTENT_FIXTURE_CREDENTIAL" },
].forEach((values) => {
  test(`F02 invalid endpoint configuration rejects: ${Object.keys(values)[0]} ${Object.values(values)[0]}`, () => {
    assert.throws(() => adapter(values), /compatible|COMPATIBLE|credential/);
  });
});

test("F03 fragmented Unicode and schwa are previewed before completion and stored exactly once", async () => {
  const previews = [];
  const a = adapter({}, { previewResponse(text) { previews.push(text); } });
  const body = new PassThrough();
  Object.assign(a.client, { /**
                             * Provides an offline transport response.
                             * @param {string} _url - Unused request route.
                             * @param {object} payload - Captured request payload.
                             * @param {object} options - Request cancellation options.
                             * @returns {Promise<object>} Simulated operation result.
                             */
  post: async (_url, payload, options) => {
    assert.equal(payload.stream, true);
    assert.equal(options.responseType, "stream");
    return { data: body };
  } });
  const pending = a.sendMessage("question");
  await new Promise(resolve => { setImmediate(resolve); });
  const text = "mañana 🦊 Əread(\"a\")";
  const first = Buffer.from(delta(text));
  // All bytes are individual chunks, including Unicode and the tool marker.
  Array.from(first).forEach(value => body.write(Buffer.from([value])));
  await new Promise(resolve => { setImmediate(resolve); });
  assert.ok(previews.includes(text));
  assert.equal(a.getHistory().filter(entry => entry.role === "assistant").length, 0);
  body.end("data: [DONE]\n\n");
  assert.equal(await pending, text);
  assert.equal(previews.at(-1), "");
  assert.deepEqual(a.getHistory().filter(entry => entry.role === "assistant").map(entry => entry.content), [text]);
});

["truncated", "error", "length", "native-tools", "cancel"].forEach((ending) => {
  test(`F03 ${ending} rolls back history and clears the partial preview`, async () => {
    const previews = [];
    const a = adapter({}, { previewResponse(text) { previews.push(text); } });
    const body = new PassThrough();
    Object.assign(a.client, { /**
                               * Provides an offline transport response.
                               * @returns {Promise<object>} Simulated operation result.
                               */
    post: async () => ({ data: body }) });
    const before = structuredClone(a.getHistory());
    const controller = new AbortController();
    const pending = a.sendMessage("question", "user", { signal: controller.signal });
    await new Promise(resolve => { setImmediate(resolve); });
    body.write(delta("partial"));
    await new Promise(resolve => { setImmediate(resolve); });
    if (ending === "error") body.destroy(new Error("stream broke"));
    else if (ending === "length") body.end('data: {"choices":[{"finish_reason":"length"}]}\n\ndata: [DONE]\n\n');
    else if (ending === "native-tools") body.end('data: {"choices":[{"delta":{"tool_calls":[{}]}}]}\n\ndata: [DONE]\n\n');
    else {
      if (ending === "cancel") controller.abort();
      if (ending !== "cancel") body.end();
    }
    await assert.rejects(pending);
    assert.deepEqual(a.getHistory(), before);
    assert.equal(previews.at(-1), "");
  });
});

test("F03 SSE handles comments and CRLF event boundaries", async () => {
  const stream = Readable.from([": heartbeat\r\n\r\n", delta("hello").replaceAll("\n", "\r\n"), "data: [DONE]\r\n\r\n"]);
  assert.equal(await readChatStream(stream), "hello");
});

test("F03 tools wait for the complete streamed response and execute once", async () => {
  const ui = {
    inputQueue: [], setIdentities(user, model) { this.model = model; }, setRenderingMode() {}, setBashEnabled() {}, setCommandHandler() {},
    previewResponse() {}, displayChatMessage() {}, displayError() {}, startToolMonitoring() {}, endToolMonitoring() {},
  };
  const a = adapter({}, ui);
  const body = new PassThrough();
  let requests = 0;
  let calls = 0;
  Object.assign(a.client, { /**
                             * Provides an offline transport response.
                             * @returns {Promise<object>} Simulated operation result.
                             */
  post: async () => { requests += 1; return { data: requests === 1 ? body : Readable.from([delta("done"), "data: [DONE]\n\n"]) }; } });
  const manager = new ChatManager({ assistant: a, ui, configManager: { get(_key, fallback) { return fallback; }, save() {}, setTemporary() {} },
    tools: { /**
              * Counts one completed tool invocation.
              * @returns {Promise<string>} Simulated operation result.
              */
    read: async () => { calls += 1; return "file"; } }, systemInstruction: "POLICY", user: { nickname: "human" }, model: { name: "fixture", nickname: "bot", temperature: 0.7 } });
  const running = manager.runOnce("question");
  await new Promise(resolve => { setImmediate(resolve); });
  body.write(delta('Əread("fix'));
  await new Promise(resolve => { setImmediate(resolve); });
  assert.equal(calls, 0);
  body.end(`${delta('ture")')}data: [DONE]\n\n`);
  await running;
  assert.equal(calls, 1);
  assert.equal(requests, 2);
});

/**
 * @param {object} t - Test context.
 * @returns {Promise<object>} Disposable command environment.
 */
async function shortcutsFixture(t) {
  const directory = await fs.mkdtemp(path.join(process.cwd(), "tmp-shortcuts-"));
  const previous = process.cwd();
  process.chdir(directory);
  await fs.mkdir(".paser-mini/config", { recursive: true });
  t.after(async () => { process.chdir(previous); await fs.rm(directory, { recursive: true, force: true }); });
  const sent = [];
  const errors = [];
  const manager = { /**
                     * Records the expanded message without command dispatch.
                     * @param {string} text - Expanded user message.
                     * @returns {Promise<void>} Simulated operation result.
                     */
  processTurn: async text => { sent.push(text); } };
  const handler = new CommandHandler(/** @type {ChatManager} */ (/** @type {unknown} */ (manager)), { displayError(text) { errors.push(text); } });
  return { handler, sent, errors, file: ".paser-mini/config/shortcuts.json" };
}

test("F04 expands a single literal instruction, preserves whitespace and never dispatches commands recursively", async t => {
  const h = await shortcutsFixture(t);
  await fs.writeFile(h.file, JSON.stringify({ corregir: "Corregí español 🦊", salir: "/quit" }));
  assert.equal(await h.handler.handle("/corregir"), true);
  await h.handler.handle("/corregir primera\nsegunda  \n");
  await h.handler.handle("/salir");
  assert.deepEqual(h.sent, ["Corregí español 🦊", "Corregí español 🦊\nprimera\nsegunda  \n", "/quit"]);
  assert.deepEqual(h.errors, []);
  await h.handler.handle("/unknown");
  assert.match(h.errors[0], /Invalid command/);
});

["{broken", "[]", '{"help":"override"}', '{"custom":5}', '{"models":"override"}'].forEach((content) => {
  test(`F04 invalid shortcut file reports a clear diagnostic: ${content}`, async t => {
    const h = await shortcutsFixture(t);
    await fs.writeFile(h.file, content);
    await h.handler.handle("/custom");
    assert.equal(h.sent.length, 0);
    assert.match(h.errors[0], /Shortcuts:/);
  });
});

test("F04 no shortcuts file preserves ordinary messages and diagnoses unknown commands", async t => {
  const h = await shortcutsFixture(t);
  assert.equal(await h.handler.handle("ordinary message"), false);
  assert.equal(await h.handler.handle("/unknown"), true);
  assert.match(h.errors[0], /Invalid command/);
});

/**
 * @param {object} t - Test context.
 * @returns {Promise<object>} Offline real CLI with injectable provider replies.
 */
async function pipelineFixture(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "paser-pipeline-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  await fs.mkdir(path.join(directory, ".paser-mini/config"), { recursive: true });
  await fs.writeFile(path.join(directory, ".paser-mini/config/config.json"), JSON.stringify({
    provider: "COMPATIBLE", model_name: "fixture", compatible_base_url: "http://localhost:9999/prefix/v1", rpm_limit: 60000000,
  }));
  const preload = path.join(directory, "offline.mjs");
  const axiosUrl = new URL("../node_modules/axios/index.js", import.meta.url).href;
  const processorUrl = new URL("../src/core/turnProcessor.js", import.meta.url).href;
  await fs.writeFile(preload, `
    import axios from ${JSON.stringify(axiosUrl)};
    import TurnProcessor from ${JSON.stringify(processorUrl)};
    let clock = 0;
    const originalProcess = TurnProcessor.prototype.process;
    if (process.env.FIXTURE_LIMIT) TurnProcessor.prototype.process = function(input) {
      this.limits = {maxDurationMs: 1, now: () => clock};
      return originalProcess.call(this, input);
    };
    if (process.env.FIXTURE_WAIT_INPUT) {
      process.stdin.on('newListener', event => {
        if (event === 'readable') setImmediate(() => process.stderr.write('FIXTURE_READY\\n'));
      });
    }
    axios.defaults.adapter = async config => {
      const request = JSON.parse(config.data);
      if (process.env.FIXTURE_LIMIT) clock = 2;
      if (process.env.FIXTURE_FAILURE) throw new Error('offline fixture failure');
      if (process.env.FIXTURE_PENDING) await new Promise((resolve, reject) => {
        process.stderr.write("FIXTURE_READY\\n");
        config.signal.addEventListener('abort', () => reject(config.signal.reason), {once:true});
      });
      return {status:200,statusText:'OK',headers:{},config,data:{choices:[{message:{content:request.messages.at(-1).content}}]}};
    };
  `);
  return {
    directory, args: ["--import", preload, new URL("../src/main.js", import.meta.url).pathname, "--pipeline", "--no-system-instruction", "--message", "Summarize"],
    env: { PATH: process.env.PATH, HOME: directory, PASER_MINI_LOG_LEVEL: "off" },
  };
}

/**
 * @param {object} h - CLI fixture.
 * @param {string} input - Whole document.
 * @param {object} [extraEnv] - Simulated failure flags.
 * @returns {Promise<object>} Exit and captured output.
 */
async function runPipeline(h, input, extraEnv = {}) {
  const child = spawn(process.execPath, h.args, { cwd: h.directory, env: { ...h.env, ...extraEnv }, stdio: "pipe" });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", chunk => { stdout += chunk; });
  child.stderr.on("data", chunk => { stderr += chunk; });
  child.stdin.end(input);
  const code = await new Promise((resolve, reject) => { child.once("error", reject); child.once("close", resolve); });
  return { stdout, stderr, code };
}

test("F01 real CLI handles multiline redirected input and returns only its reply", async t => {
  const h = await pipelineFixture(t);
  const result = await runPipeline(h, "/exit\nmañana 🦊\n");
  assert.equal(result.code, 0, result.stderr);
  assert.equal(result.stdout, "Summarize\n\n/exit\nmañana 🦊\n\n");
  assert.equal(result.stderr, "");
});

["empty", "transport"].forEach((failure) => {
  test(`F01 real CLI ${failure} fails with clean stdout`, async t => {
    const h = await pipelineFixture(t);
    const result = await runPipeline(h, failure === "empty" ? "" : "document", failure === "transport" ? { FIXTURE_FAILURE: "1" } : {});
    assert.notEqual(result.code, 0);
    assert.equal(result.stdout, "");
    assert.match(result.stderr, failure === "empty" ? /stdin is empty/ : /offline fixture failure/);
  });
});

test("F03 retry discards failed fragments before storing the successful reply", async () => {
  const previews = [];
  const a = adapter({}, { previewResponse(text) { previews.push(text); } });
  a.retryHandler.maxRetries = 2;
  a.retryHandler.maxDelay = 0;
  let attempts = 0;
  Object.assign(a.client, {
    /** @returns {Promise<object>} A broken stream followed by a complete response. */
    post: async () => {
      attempts += 1;
      if (attempts === 2) return { data: Readable.from([delta("fresh"), "data: [DONE]\n\n"]) };
      const body = new PassThrough();
      setImmediate(() => { body.write(delta("stale")); setImmediate(() => body.destroy(Object.assign(new Error("reset"), { code: "ECONNRESET" }))); });
      return { data: body };
    },
  });
  assert.equal(await a.sendMessage("question"), "fresh");
  assert.deepEqual(previews, ["stale", "", "fresh", ""]);
  assert.deepEqual(a.getHistory().map(entry => entry.content), ["POLICY", "question", "fresh"]);
});

[false, true].forEach(pendingInput => {
  test(`F01 real CLI signal interrupts ${pendingInput ? "stdin" : "generation"} with a nonzero exit`, async t => {
    const h = await pipelineFixture(t);
    const child = spawn(process.execPath, h.args, {
      cwd: h.directory, env: { ...h.env, ...(pendingInput ? { FIXTURE_WAIT_INPUT: "1" } : { FIXTURE_PENDING: "1" }) }, stdio: "pipe",
    });
    t.after(() => { if (child.exitCode === null) child.kill("SIGKILL"); });
    let stdout = "";
    let stderr = "";
    let signaled = false;
    child.stdout.on("data", chunk => { stdout += chunk; });
    child.stderr.on("data", chunk => {
      stderr += chunk;
      if (!signaled && stderr.includes("FIXTURE_READY")) { signaled = true; child.kill("SIGINT"); }
    });
    if (!pendingInput) child.stdin.end("document");
    const timer = setTimeout(() => child.kill("SIGKILL"), 15000);
    const code = await new Promise((resolve, reject) => { child.once("error", reject); child.once("close", resolve); });
    clearTimeout(timer);
    assert.equal(code, 130, stderr);
    assert.equal(stdout, "");
    assert.match(stderr, /interrupted/);
    child.stdin.destroy();
  });
});

test("F01 real CLI scheduling limits leave stdout empty and fail", async t => {
  const h = await pipelineFixture(t);
  const result = await runPipeline(h, "document", { FIXTURE_LIMIT: "1" });
  assert.notEqual(result.code, 0);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /Turn time limit/);
});

test("F01 real CLI reads a redirected file through EOF", async t => {
  const h = await pipelineFixture(t);
  const file = path.join(h.directory, "notes.txt");
  await fs.writeFile(file, "first\nsecond 🦊\n");
  const input = await fs.open(file, "r");
  try {
    const child = spawn(process.execPath, h.args, { cwd: h.directory, env: h.env, stdio: [input.fd, "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", chunk => { stdout += chunk; });
    child.stderr.on("data", chunk => { stderr += chunk; });
    const code = await new Promise((resolve, reject) => { child.once("error", reject); child.once("close", resolve); });
    assert.equal(code, 0, stderr);
    assert.equal(stdout, "Summarize\n\nfirst\nsecond 🦊\n\n");
    assert.equal(stderr, "");
  } finally {
    await input.close();
  }
});

test("F03 complete oversized SSE events fail before their text is accepted", async () => {
  const stream = Readable.from([delta("🦊".repeat(270000)), "data: [DONE]\n\n"]);
  await assert.rejects(readChatStream(stream), /event too large/);
});

test("F04 terminal input preserves shortcut payload whitespace when delivered directly or queued", async t => {
  const { createInterface } = readline;
  t.mock.method(readline, "createInterface", () => createInterface({ input: new PassThrough(), output: new PassThrough(), terminal: false }));
  const input = new TerminalInput();
  t.after(() => input.close());
  input.init();
  const pending = input.requestInput("");
  input.rl.emit("line", "  /corregir español 🦊  ");
  assert.equal(await pending, "/corregir español 🦊  ");
  input.rl.emit("line", "/corregir second  ");
  assert.equal(await input.requestInput(""), "/corregir second  ");
  input.rl.emit("line", " ordinary message  ");
  assert.equal(await input.requestInput(""), "ordinary message");
});
