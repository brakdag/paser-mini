import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { PassThrough } from "node:stream";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import mcpManager, { McpManager } from "../src/infrastructure/McpManager.js";
import { SystemPromptManager } from "../src/core/systemPromptManager.js";

test("stdio MCP receives resolved environment overrides without changing the parent environment", async (t) => {
  t.mock.method(Client.prototype, "connect", async () => {});
  t.mock.method(Client.prototype, "listTools", async () => ({ tools: [] }));
  let received;
  const manager = new McpManager({
    createStdioTransport(options) {
      received = options;
      return { stderr: new PassThrough() };
    },
  });
  const originalPath = process.env.PATH;
  const config = {
    command: "fixture-command",
    args: ["--fixture"],
    env: { PATH: "/fixture/bin", MCP_VALUE: `prefix-\${PATH}`, MCP_EMPTY: "" },
  };
  await manager.connectServer("fixture", config);
  assert.equal(manager.clients.size, 1);
  assert.equal(received.command, "fixture-command");
  assert.deepEqual(received.args, ["--fixture"]);
  assert.deepEqual(received.env, {
    PATH: "/fixture/bin", MCP_VALUE: `prefix-${originalPath}`, MCP_EMPTY: "",
  });
  assert.equal(config.env.MCP_VALUE, `prefix-\${PATH}`);
  assert.equal(process.env.PATH, originalPath);
});

test("stdio MCP without env preserves the SDK default environment behavior", async (t) => {
  t.mock.method(Client.prototype, "connect", async () => {});
  t.mock.method(Client.prototype, "listTools", async () => ({ tools: [] }));
  let received;
  const manager = new McpManager({
    createStdioTransport(options) {
      received = options;
      return { stderr: new PassThrough() };
    },
  });
  await manager.connectServer("fixture", { command: "fixture-command" });
  assert.equal(manager.clients.size, 1);
  assert.equal(received.env, undefined);
  assert.deepEqual(received.args, []);
});

/**
 * Creates a manager whose transports never start a process.
 * @returns {McpManager} Isolated manager with simulated stdio.
 */
function fixtureManager() {
  return new McpManager({
    /**
     * Creates a transport stub without spawning processes.
     * @returns {object} Simulated transport with a diagnostic stream.
     */
    createStdioTransport() { return { stderr: new PassThrough() }; },
  });
}

/**
 * Installs a small remote tool catalogue using the SDK client seam.
 * @param {object} t - Test context.
 * @param {string[]} names - Remote tool names.
 */
function mockServer(t, names = ["echo"]) {
  t.mock.method(Client.prototype, "connect", async () => {});
  t.mock.method(Client.prototype, "listTools", async () => ({
    tools: names.map((name) => ({ name, inputSchema: { type: "object" } })),
  }));
  t.mock.method(Client.prototype, "close", async () => {});
  t.mock.method(Client.prototype, "callTool", async ({ name }) => ({ content: [{ text: name }] }));
}

test("failed discovery closes the unpublished client and permits a successful retry", async (t) => {
  mockServer(t);
  let attempts = 0;
  t.mock.method(Client.prototype, "listTools", async () => {
    attempts += 1;
    if (attempts === 1) throw new Error("discovery unavailable");
    return { tools: [{ name: "echo", inputSchema: {} }] };
  });
  const manager = fixtureManager();
  await manager.connectServer("fixture", { command: "fake" });
  assert.equal(manager.clients.size, 0);
  assert.deepEqual(manager.getTools(), {});
  assert.equal(Client.prototype.close.mock.callCount(), 1);
  await manager.connectServer("fixture", { command: "fake" });
  assert.equal(await manager.getTools().mcp_fixture_echo({}), "echo");
  await manager.shutdown();
});

test("failed handshake closes the client and does not block reconnection", async (t) => {
  mockServer(t);
  t.mock.method(Client.prototype, "connect", async () => { throw new Error("connect failed"); });
  const manager = fixtureManager();
  await manager.connectServer("fixture", { command: "fake" });
  assert.equal(manager.clients.size, 0);
  assert.equal(Client.prototype.close.mock.callCount(), 1);
  t.mock.method(Client.prototype, "connect", async () => {});
  await manager.connectServer("fixture", { command: "fake" });
  assert.equal(manager.clients.size, 1);
  await manager.shutdown();
});

test("server and tool normalization collisions never overwrite active tools", async (t) => {
  mockServer(t);
  const manager = fixtureManager();
  await manager.connectServer("a-b", { command: "fake" });
  const original = manager.getTools().mcp_a_b_echo;
  await manager.connectServer("a.b", { command: "fake" });
  assert.equal(manager.clients.size, 1);
  assert.equal(manager.getTools().mcp_a_b_echo, original);
  t.mock.method(Client.prototype, "listTools", async () => ({
    tools: [{ name: "x-y", inputSchema: {} }, { name: "x.y", inputSchema: {} }],
  }));
  await manager.connectServer("other", { command: "fake" });
  assert.equal(manager.clients.size, 1);
  assert.deepEqual(Object.keys(manager.getTools()), ["mcp_a_b_echo"]);
  await manager.shutdown();
});

test("disconnect removes exact ownership and invalidates tools copied into an engine", async (t) => {
  mockServer(t, ["echo", "child_echo"]);
  const manager = fixtureManager();
  await manager.connectServer("a", { command: "fake" });
  // Same final name across different server/tool boundaries must also be rejected.
  await manager.connectServer("a_child", { command: "fake" });
  assert.equal(manager.clients.size, 1);
  t.mock.method(Client.prototype, "listTools", async () => ({ tools: [{ name: "other", inputSchema: {} }] }));
  await manager.connectServer("a_child", { command: "fake" });
  const copied = manager.getTools().mcp_a_echo;
  await manager.disconnectServer("a");
  assert.deepEqual(Object.keys(manager.getTools()), ["mcp_a_child_other"]);
  assert.deepEqual(Object.keys(manager.getSchemas()), ["mcp_a_child_other"]);
  await assert.rejects(copied({}), /disconnected/);
  assert.equal(await manager.getTools().mcp_a_child_other({}), "other");
  await manager.shutdown();
});

test("shutdown clears catalog even on close errors and remains idempotent", async (t) => {
  mockServer(t);
  const manager = fixtureManager();
  await manager.connectServer("fixture", { command: "fake" });
  const copied = manager.getTools().mcp_fixture_echo;
  t.mock.method(Client.prototype, "close", async () => { throw new Error("close failed"); });
  await manager.shutdown();
  await manager.shutdown();
  assert.equal(manager.clients.size, 0);
  assert.deepEqual(manager.getTools(), {});
  assert.deepEqual(manager.getSchemas(), {});
  await assert.rejects(copied({}), /disconnected/);
  assert.equal(Client.prototype.close.mock.callCount(), 1);
});

test("unexpected close removes tools and a stale close cannot retire a replacement", async (t) => {
  mockServer(t);
  const manager = fixtureManager();
  await manager.connectServer("fixture", { command: "fake" });
  const oldClient = manager.clients.get("fixture");
  const copied = manager.getTools().mcp_fixture_echo;
  oldClient.onclose();
  assert.equal(manager.clients.size, 0);
  assert.deepEqual(manager.getTools(), {});
  assert.deepEqual(manager.getSchemas(), {});
  await assert.rejects(copied({}), /disconnected/);
  await manager.connectServer("fixture", { command: "fake" });
  oldClient.onclose();
  await assert.rejects(copied({}), /disconnected/);
  assert.equal(await manager.getTools().mcp_fixture_echo({}), "echo");
  await manager.shutdown();
});

test("disconnect queued during discovery prevents late publication and duplicate connections", async (t) => {
  mockServer(t);
  let release;
  const discovery = new Promise((resolve) => { release = resolve; });
  t.mock.method(Client.prototype, "listTools", () => discovery);
  const manager = fixtureManager();
  const first = manager.connectServer("fixture", { command: "fake" });
  const second = manager.connectServer("fixture", { command: "fake" });
  const disconnect = manager.disconnectServer("fixture");
  release({ tools: [{ name: "echo", inputSchema: {} }] });
  await Promise.all([first, second, disconnect]);
  assert.equal(Client.prototype.connect.mock.callCount(), 1);
  assert.equal(Client.prototype.close.mock.callCount(), 1);
  assert.deepEqual(manager.getTools(), {});
  assert.equal(manager.clients.size, 0);
});

test("close during discovery cannot publish a dead connection", async (t) => {
  mockServer(t);
  t.mock.method(Client.prototype, "listTools", async function discover() {
    this.onclose();
    return { tools: [{ name: "echo", inputSchema: {} }] };
  });
  const manager = fixtureManager();
  await manager.connectServer("fixture", { command: "fake" });
  assert.equal(manager.clients.size, 0);
  assert.deepEqual(manager.getTools(), {});
});


test("configuration reload reconciles changed, disabled, removed and missing servers", async (t) => {
  mockServer(t);
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "paser-mcp-lifecycle-"));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const manager = fixtureManager();
  manager.configPath = path.join(dir, "mcp.json");
  await fs.writeFile(manager.configPath, JSON.stringify({ mcpServers: {
    first: { command: "fake" }, second: { command: "fake" }, third: { command: "fake" },
  } }));
  await manager.initialize();
  t.mock.method(mcpManager, "initialize", () => manager.initialize());
  t.mock.method(mcpManager, "getTools", () => manager.getTools());
  t.mock.method(mcpManager, "getSchemas", () => manager.getSchemas());
  const prompt = new SystemPromptManager({ cacheDir: path.join(dir, "cache") });
  const options = { injectSystemInstruction: "Fixture role" };
  const initialPrompt = await prompt.buildPrompt(options);
  const copied = initialPrompt.filteredTools.mcp_second_echo;
  assert.equal(await copied({}), "echo");
  assert.match(initialPrompt.systemInstruction, /mcp_second_echo/);
  prompt.saveCache();
  const previous = manager.clients.get("first");
  await manager.initialize();
  assert.equal(Client.prototype.connect.mock.callCount(), 3);
  await fs.writeFile(manager.configPath, JSON.stringify({ mcpServers: {
    first: { command: "changed" }, second: { command: "fake", enabled: false },
  } }));
  await manager.initialize();
  assert.equal(manager.clients.size, 1);
  assert.notEqual(manager.clients.get("first"), previous);
  assert.deepEqual(Object.keys(manager.getTools()), ["mcp_first_echo"]);
  const refreshed = await prompt.buildPrompt(options);
  assert.equal(refreshed.filteredTools.mcp_second_echo, undefined);
  assert.equal(refreshed.filteredTools.mcp_third_echo, undefined);
  assert.doesNotMatch(refreshed.systemInstruction, /mcp_second_echo|mcp_third_echo/);
  await assert.rejects(copied({}), /disconnected/);
  await fs.unlink(manager.configPath);
  await manager.initialize();
  assert.equal(manager.clients.size, 0);
  assert.deepEqual(manager.getTools(), {});
});


test("normalized tool identifiers still invoke the original remote tool name", async (t) => {
  mockServer(t, ["echo.value"]);
  const manager = fixtureManager();
  await manager.connectServer("fixture-server", { command: "fake" });
  assert.equal(await manager.getTools().mcp_fixture_server_echo_value({}), "echo.value");
  assert.deepEqual(Object.keys(manager.getSchemas()), ["mcp_fixture_server_echo_value"]);
  await manager.shutdown();
});
