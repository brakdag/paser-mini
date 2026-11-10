import { test } from "node:test";
import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { PassThrough } from "node:stream";
import mcpManager, { McpManager } from "../src/infrastructure/McpManager.js";
import ExecutionEngine from "../src/core/executionEngine.js";
import SmartToolParser from "../src/core/smartParser.js";
import ToolExecutor from "../src/core/toolExecutor.js";
import TurnProcessor from "../src/core/turnProcessor.js";
import RepetitionDetector from "../src/core/repetitionDetector.js";
import TerminalUI from "../src/core/terminalUI.js";
import { normalizeToolResult, toolResultsContent } from "../src/core/toolResult.js";
import { normalizeContent } from "../src/infrastructure/historyNormalizer.js";

const image = { type: "image", mimeType: "image/png", data: "YWJj" };
const resource = { type: "resource", resource: { uri: "fixture:///readme", mimeType: "text/plain", text: "resource body" } };
const binary = { type: "resource", resource: { uri: "fixture:///file", mimeType: "application/octet-stream", blob: "ZGVm" } };
const unknown = { type: "future", payload: { ordered: [1, 2] } };
const audio = { type: "audio", mimeType: "audio/wav", data: "YXVkaW8=" };
const link = { type: "resource_link", uri: "fixture:///linked", name: "linked", mimeType: "text/plain" };
const rich = [{ type: "text", text: "first" }, image, resource, binary, unknown, audio, link, { type: "text", text: "last" }];

/**
 * Records production engine output without terminal effects.
 * @returns {object} Fake UI and captured state.
 */
function recordingUI() {
  return {
    model: { nickname: "agent" }, inputQueue: [], monitored: [], displayed: [],
    startToolMonitoring() {},
    endToolMonitoring(name, success) { this.monitored.push({ name, success }); },
    displayChatMessage(name, message) { this.displayed.push({ name, message }); },
    displayRawMessage(message) { this.displayed.push(message); },
    displayError(message) { throw new Error(message); },
  };
}

test("normalization preserves mixed blocks, annotations, metadata and assistant thought filtering", () => {
  const input = ["before", image, resource, unknown, "<thought>private</thought>after"];
  const normalized = normalizeContent(input, "assistant");
  assert.deepEqual(normalized, [{ type: "text", text: "before" }, image, resource, unknown, { type: "text", text: "after" }]);
  assert.equal(input[4], "<thought>private</thought>after");
  const outcome = normalizeToolResult({ content: rich, isError: true, structuredContent: { answer: 42 }, _meta: { trace: "abc" } });
  assert.equal(outcome.isError, true);
  assert.deepEqual(outcome.content, rich);
  assert.deepEqual(outcome.metadata, { structuredContent: { answer: 42 }, _meta: { trace: "abc" } });
  assert.match(JSON.stringify(toolResultsContent([{ name: "remote", outcome }])), /answer/);
});

test("native typed objects remain JSON results rather than unknown media", () => {
  const result = normalizeToolResult({ type: "PNG", signature: "89504e47" });
  assert.deepEqual(result.content, [{ type: "text", text: '{"type":"PNG","signature":"89504e47"}' }]);
  const legacy = normalizeToolResult({ mime_type: "image/jpeg", data: "YWJj", resolution: "1x1" });
  assert.deepEqual(legacy.content[1], { type: "image", mimeType: "image/jpeg", data: "YWJj" });
});

test("two MCP tools retain block order and remote errors through the real turn and UI", async (t) => {
  const first = { content: [{ type: "text", text: "tool one" }, image], isError: false };
  const second = { content: rich, isError: true, structuredContent: { reason: "remote failure" } };
  t.mock.method(Client.prototype, "connect", async () => {});
  t.mock.method(Client.prototype, "close", async () => {});
  t.mock.method(Client.prototype, "listTools", async () => ({
    tools: ["first", "second"].map(name => ({ name, inputSchema: { type: "object", properties: {} } })),
  }));
  t.mock.method(Client.prototype, "callTool", async ({ name }) => (name === "first" ? first : second));
  const manager = new McpManager({ createStdioTransport() { return { stderr: new PassThrough() }; } });
  t.after(() => manager.shutdown());
  await manager.connectServer("fixture", { command: "fake" });
  assert.deepEqual(await manager.getTools().mcp_fixture_second({}), second);
  const parser = new SmartToolParser();
  t.mock.method(mcpManager, "getSchemas", () => manager.getSchemas());
  const ui = recordingUI();
  const tools = manager.getTools();
  const engine = new ExecutionEngine(tools, parser, ui);
  const sent = [];
  const assistant = {
    async sendMessage(message) {
      sent.push(message);
      return sent.length === 1 ? 'Əmcp_fixture_first() Əmcp_fixture_second()' : "done";
    },
  };
  const turn = new TurnProcessor(assistant, tools, parser, engine, ui, new RepetitionDetector());
  await turn.process("go");
  assert.equal(sent.length, 2);
  assert.deepEqual(ui.monitored.map(entry => entry.success), [true, false]);
  assert.deepEqual(ui.displayed, [{ name: "agent", message: "done" }]);
  assert.deepEqual(sent[1], [
    { type: "text", text: "[mcp_fixture_first] ✓ OK" }, ...first.content,
    { type: "text", text: "[mcp_fixture_second] ✗ ERROR" }, ...rich,
    { type: "text", text: '[Tool metadata] {"structuredContent":{"reason":"remote failure"}}' },
  ]);
});

["success", "remote error", "exception"].forEach(status => {
  test(`terminal shows only the tool call and status for ${status}, preserving the result for the model`, async (t) => {
    const ui = new TerminalUI();
    const output = [];
    const logged = [];
    t.after(() => ui.close());
    t.mock.method(process.stdout, "write", text => { output.push(String(text)); return true; });
    t.mock.method(ui, "writeToLog", text => { logged.push(text); });
    const parser = new SmartToolParser();
    const tools = {
      async search() {
        if (status === "exception") throw new Error("private failure body");
        return { content: rich, isError: status === "remote error", structuredContent: { answer: 42 } };
      },
    };
    const engine = new ExecutionEngine(tools, parser, ui);
    const sent = [];
    const assistant = {
      async sendMessage(message) {
        sent.push(message);
        return sent.length === 1 ? 'Əsearch("busqueda")ə' : "done";
      },
    };
    const turn = new TurnProcessor(assistant, tools, parser, engine, ui, new RepetitionDetector());
    await turn.process("go");
    const icon = status === "success" ? "✓" : "✗";
    assert.match(output[0], new RegExp(`search \\(busqueda\\) ${icon}`));
    assert.equal(output.length, 2);
    assert.match(output[1], /done/);
    assert.equal(logged.length, 2);
    assert.match(logged[0], new RegExp(`search \\(busqueda\\) ${icon}`));
    assert.doesNotMatch([...output, ...logged].join("\n"), /first|resource body|YWJj|ZGVm|structuredContent|private failure body|Ə|ə/);
    assert.match(JSON.stringify(sent[1]), status === "exception" ? /private failure body/ : /resource body.*answer/s);
    assert.equal(ui.activeSpinners.size, 0);
  });
});

["FOUNTAIN_INJECTION", "QR_DISPLAY"].forEach(type => {
  [false, true].forEach(isError => {
    test(`${type} dispatches local control only on success (${isError})`, async () => {
      const ui = recordingUI();
      const parser = new SmartToolParser();
      const tools = {
        /** @returns {Promise<object>} Simulated local action. */
        special: async () => ({ type, content: "special content", isError }),
      };
      const engine = new ExecutionEngine(tools, parser, ui);
      const injected = [];
      const result = await ToolExecutor.execute([{ data: { name: "special", args: {} } }], engine, ui,
        { injectMessage(role, content) { injected.push({ role, content }); } }, parser);
      assert.equal(result.executionErrorCount, isError ? 1 : 0);
      assert.equal(result.terminate, type === "FOUNTAIN_INJECTION" && !isError);
      assert.equal(ui.displayed.length, isError ? 0 : 1);
      if (isError) assert.equal(result.results[0].outcome.isError, true);
    });
  });
});

const providers = ["gemini", "nvidia", "nvidia-minimax", "cohere", "zai", "groq", "cerebras", "cloudflare", "openrouter", "huggingface", "poolside", "zenmux"];
providers.forEach(provider => {
  test(`${provider}: wire payload preserves text order and explicitly handles unsupported content`, async () => {
    const { default: Adapter } = await import(`../src/infrastructure/${provider}/adapter.js`);
    const adapter = new Adapter({ ui: {}, configManager: { get(key, fallback) { return key === "rpm_limit" ? 60000000 : fallback; } } });
    const client = adapter.restClient?.client || adapter.client;
    let payload = {};
    /**
     * Captures the actual serialized request without network access.
     * @param {object} config - Axios request configuration.
     * @returns {Promise<object>} Simulated HTTP response.
     */
    client.defaults.adapter = async config => {
      payload = JSON.parse(config.data);
      return { status: 200, statusText: "OK", headers: {}, config, data: {
        choices: [{ message: { content: "Answer" } }],
        candidates: [{ content: { parts: [{ text: "Answer" }] } }],
        message: { content: [{ text: "Answer" }] },
      } };
    };
    adapter.setImmersionMode(true);
    await adapter.sendMessage(rich);
    const serialized = JSON.stringify(payload);
    assert.doesNotMatch(serialized, /\[object Object\]/);
    assert.ok(serialized.indexOf("first") < serialized.indexOf("resource body"));
    assert.ok(serialized.indexOf("resource body") < serialized.indexOf("last"));
    assert.match(serialized, /Unsupported content: resource/);
    assert.match(serialized, /Unsupported content: future/);
    if (provider === "gemini") {
      assert.deepEqual(payload.contents[0].parts[1], { inline_data: { mime_type: "image/png", data: "YWJj" } });
    } else if (provider === "openrouter") {
      assert.deepEqual(payload.messages[0].content[1], { type: "image_url", image_url: { url: "data:image/png;base64,YWJj" } });
    } else {
      assert.match(serialized, /Unsupported content: image/);
      assert.doesNotMatch(serialized, /YWJj/);
    }
    // The unprojected original survives even when the adapter cannot send it.
    const history = JSON.stringify(adapter.getHistory());
    assert.match(history, /YWJj/);
    assert.match(history, /ZGVm/);
    assert.match(history, /ordered/);
  });
});

test("remote isError counts toward turn error limits and never records success", async (t) => {
  const ui = recordingUI();
  const errors = [];
  /** @param {string} message - Turn termination explanation. */
  ui.displayError = message => { errors.push(message); };
  const parser = new SmartToolParser();
  const tools = {
    /** @returns {Promise<object>} Remote failure returned without throwing. */
    read: async () => ({ content: [{ type: "text", text: "remote denied" }], isError: true }),
  };
  const engine = new ExecutionEngine(tools, parser, ui);
  const successes = t.mock.method(engine.toolTracker, "recordSuccess");
  let requests = 0;
  const assistant = {
    async sendMessage() { requests += 1; return 'Əread("file") Əread("file") Əread("file")'; },
  };
  const turn = new TurnProcessor(assistant, tools, parser, engine, ui, new RepetitionDetector(), { maxErrors: 2 });
  await assert.rejects(turn.process("go"), /consecutive error limit/);
  assert.equal(requests, 1);
  assert.equal(ui.monitored.length, 2);
  assert.equal(successes.mock.callCount(), 0);
  assert.match(errors[0], /consecutive error limit/);
});

test("Fountain preserves earlier rich tool results and remote metadata cannot trigger local actions", async () => {
  const parser = new SmartToolParser();
  const ui = recordingUI();
  const tools = {
    /** @returns {Promise<object>} Remote content with an unrelated metadata type. */
    remote: async () => ({ type: "FOUNTAIN_INJECTION", content: rich }),
    /** @returns {Promise<object>} Local Fountain action. */
    scene: async () => ({ type: "FOUNTAIN_INJECTION", content: "scene" }),
  };
  const engine = new ExecutionEngine(tools, parser, ui);
  const injected = [];
  const result = await ToolExecutor.execute([
    { data: { name: "remote", args: {} } }, { data: { name: "scene", args: { scene: "scene", action: "action" } } },
  ], engine, ui, { injectMessage(role, content) { injected.push({ role, content }); } }, parser);
  assert.equal(result.terminate, true);
  assert.deepEqual(ui.displayed, [{ name: "system", message: "scene" }]);
  assert.deepEqual(injected[0].content.slice(1, 1 + rich.length), rich);
  assert.equal(injected[1].content, "scene");
});
