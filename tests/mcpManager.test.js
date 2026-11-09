import { test } from "node:test";
import assert from "node:assert/strict";
import { PassThrough } from "node:stream";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { McpManager } from "../src/infrastructure/McpManager.js";

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
