import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { SystemPromptManager } from "../src/core/systemPromptManager.js";
import mcpManager from "../src/infrastructure/McpManager.js";

test("prompt cache distinguishes instruction files with identical modification times", async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "paser-prompt-cache-"));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  t.mock.method(mcpManager, "initialize", async () => {});
  t.mock.method(mcpManager, "getTools", () => ({}));
  t.mock.method(mcpManager, "getSchemas", () => ({}));
  const first = path.join(dir, "first.txt");
  const second = path.join(dir, "second.txt");
  await fs.writeFile(first, "First role");
  await fs.writeFile(second, "Second role");
  const timestamp = new Date("2026-01-01T00:00:00Z");
  await fs.utimes(first, timestamp, timestamp);
  await fs.utimes(second, timestamp, timestamp);
  const manager = new SystemPromptManager({ cacheDir: path.join(dir, "cache") });
  const initial = await manager.buildPrompt({ fileSystemInstruction: first, systemInstruction: "Base" });
  assert.match(initial.systemInstruction, /First role/);
  manager.saveCache();
  const next = await manager.buildPrompt({ fileSystemInstruction: second, systemInstruction: "Base" });
  assert.match(next.systemInstruction, /Second role/);
  assert.doesNotMatch(next.systemInstruction, /First role/);
  manager.saveCache();
  const cached = await manager.buildPrompt({ fileSystemInstruction: second, systemInstruction: "Base" });
  assert.equal(cached.systemInstruction, next.systemInstruction);
  assert.equal(manager._pendingCache, null);
  const stored = JSON.parse(await fs.readFile(manager.cacheFile, "utf8"));
  assert.ok(stored.dependencies.every((file) => path.isAbsolute(file)));
  assert.equal(stored.dependencies.at(-1), second);
  await fs.access(stored.dependencies[0]);
});

test("prompt cache detects changed contents with a preserved timestamp", async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "paser-prompt-content-"));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  t.mock.method(mcpManager, "initialize", async () => {});
  t.mock.method(mcpManager, "getTools", () => ({}));
  t.mock.method(mcpManager, "getSchemas", () => ({}));
  const file = path.join(dir, "role.txt");
  await fs.writeFile(file, "Original role");
  const timestamp = new Date("2026-01-01T00:00:00Z");
  await fs.utimes(file, timestamp, timestamp);
  const manager = new SystemPromptManager({ cacheDir: path.join(dir, "cache") });
  const options = { fileSystemInstruction: file, systemInstruction: "Base" };
  await manager.buildPrompt(options);
  manager.saveCache();
  await fs.writeFile(file, "Modified role");
  await fs.utimes(file, timestamp, timestamp);
  const next = await manager.buildPrompt(options);
  assert.match(next.systemInstruction, /Modified role/);
  assert.doesNotMatch(next.systemInstruction, /Original role/);
});

test("disconnected MCP tools are removed from prompts without mutating the bundled registry", async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "paser-prompt-mcp-"));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  t.mock.method(mcpManager, "initialize", async () => {});
  const tool = { execute() {} };
  let connected = true;
  t.mock.method(mcpManager, "getTools", () => connected ? { mcp_fixture_echo: tool } : {});
  t.mock.method(mcpManager, "getSchemas", () => connected ? { mcp_fixture_echo: { properties: {} } } : {});
  const manager = new SystemPromptManager({ cacheDir: path.join(dir, "cache") });
  const first = await manager.buildPrompt({ injectSystemInstruction: "Fixture role" });
  assert.equal(first.filteredTools.mcp_fixture_echo, tool);
  assert.match(first.systemInstruction, /mcp_fixture_echo/);
  manager.saveCache();
  connected = false;
  const next = await manager.buildPrompt({ injectSystemInstruction: "Fixture role" });
  assert.equal(next.filteredTools.mcp_fixture_echo, undefined);
  assert.doesNotMatch(next.systemInstruction, /mcp_fixture_echo/);
  const { AVAILABLE_TOOLS } = await import("../src/infrastructure/registry.js");
  assert.equal(AVAILABLE_TOOLS.mcp_fixture_echo, undefined);
});

test("prompt cache refreshes the date and changed schemas for an existing MCP tool", async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "paser-prompt-refresh-"));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  t.mock.method(mcpManager, "initialize", async () => {});
  t.mock.method(mcpManager, "getTools", () => ({ mcp_fixture_echo() {} }));
  let description = "Original schema";
  t.mock.method(mcpManager, "getSchemas", () => ({
    mcp_fixture_echo: { description, properties: {} },
  }));
  let date = "Fixture day one";
  t.mock.method(Date.prototype, "toDateString", () => date);
  const manager = new SystemPromptManager({ cacheDir: path.join(dir, "cache") });
  const options = { injectSystemInstruction: "Fixture role" };
  const first = await manager.buildPrompt(options);
  assert.match(first.systemInstruction, /Original schema/);
  assert.match(first.systemInstruction, /Fixture day one/);
  manager.saveCache();

  description = "Updated schema";
  const updated = await manager.buildPrompt(options);
  assert.match(updated.systemInstruction, /Updated schema/);
  assert.doesNotMatch(updated.systemInstruction, /Original schema/);
  manager.saveCache();

  date = "Fixture day two";
  const nextDay = await manager.buildPrompt(options);
  assert.match(nextDay.systemInstruction, /Fixture day two/);
  assert.doesNotMatch(nextDay.systemInstruction, /Fixture day one/);
});
