import { test } from "node:test";
import assert from "node:assert/strict";
import fsp from "node:fs/promises";
import parseCliOptions from "../src/core/cliOptions.js";
import { SystemPromptManager } from "../src/core/systemPromptManager.js";
import mcpManager from "../src/infrastructure/McpManager.js";

["--no-system-instruction", "-nsi"].forEach((flag) => {
  test(`${flag} selects pure mode and bypasses MCP and prompt files`, async (t) => {
    const options = parseCliOptions(["node", "paser-mini", flag, "-fsi", "/missing/injection.txt"]);
    assert.equal(options.pureMode, true);
    assert.equal(options.systemInstruction, undefined);
    const initialize = t.mock.method(mcpManager, "initialize", async () => {
      throw new Error("Pure mode must not initialize MCP");
    });
    const context = await new SystemPromptManager().buildPrompt(options);
    assert.deepEqual(context, { systemInstruction: "", filteredTools: {}, pureMode: true });
    assert.equal(initialize.mock.callCount(), 0);
  });
});

test("normal mode initializes MCP and preserves an explicitly empty custom prompt", async (t) => {
  const initialize = t.mock.method(mcpManager, "initialize", async () => undefined);
  t.mock.method(mcpManager, "getTools", () => ({}));
  t.mock.method(mcpManager, "getSchemas", () => ({}));
  const manager = new SystemPromptManager();
  manager._forceRebuild = true;
  t.mock.method(manager, "_exists", async () => false);
  const context = await manager.buildPrompt(parseCliOptions(["node", "paser-mini", "-si", ""]));
  assert.equal(context.systemInstruction, "");
  assert.equal(context.pureMode, false);
  assert.equal(typeof context.filteredTools.read, "function");
  assert.equal(initialize.mock.callCount(), 1);
  assert.ok(manager._pendingCache);
  const pure = await manager.buildPrompt(parseCliOptions(["node", "paser-mini", "-nsi"]));
  assert.equal(pure.pureMode, true);
  assert.equal(manager._pendingCache, null);
  assert.equal(initialize.mock.callCount(), 1);
  assert.deepEqual(await manager.rebuildCache(), pure);
  assert.equal(initialize.mock.callCount(), 1);
});

test("default and custom system instructions do not imply pure mode", () => {
  assert.equal(parseCliOptions(["node", "paser-mini"]).pureMode, false);
  const options = parseCliOptions(["node", "paser-mini", "-si", "Custom", "-isi", "Role", "-m", "Hello", "--github-mode"]);
  assert.equal(options.pureMode, false);
  assert.equal(options.systemInstruction, "Custom");
  assert.equal(options.injectSystemInstruction, "Role");
  assert.equal(options.message, "Hello");
  assert.equal(options.githubMode, true);
  assert.equal(parseCliOptions(["node", "paser-mini", "-si", ""]).pureMode, false);
});

test("the last system instruction option wins when positive and negative flags are combined", () => {
  const disabled = parseCliOptions(["node", "paser-mini", "-si", "Custom", "-nsi"]);
  assert.equal(disabled.pureMode, true);
  assert.equal(disabled.systemInstruction, undefined);
  const custom = parseCliOptions(["node", "paser-mini", "-nsi", "-si", "Custom"]);
  assert.equal(custom.pureMode, false);
  assert.equal(custom.systemInstruction, "Custom");
});

[false, true].forEach((hasExplicitMode) => {
  test(`prompt cache ${hasExplicitMode ? "preserves an explicit mode" : "rebuilds legacy entries"}`, async (t) => {
    t.mock.method(mcpManager, "initialize", async () => undefined);
    t.mock.method(mcpManager, "getTools", () => ({}));
    t.mock.method(mcpManager, "getSchemas", () => ({}));
    const manager = new SystemPromptManager();
    t.mock.method(manager, "_exists", async () => false);
    t.mock.method(manager, "_getMtimes", async () => [0, 0, 0, 0]);
    t.mock.method(fsp, "readFile", async () => JSON.stringify({
      mtimes: [0, 0, 0, 0],
      options: { systemInstruction: "", ...(hasExplicitMode ? { pureMode: false } : {}) },
      filteredToolNames: ["read"],
      systemInstruction: "Cached prompt",
    }));
    const context = await manager.buildPrompt(parseCliOptions(["node", "paser-mini", "-si", ""]));
    assert.equal(context.pureMode, false);
    assert.equal(typeof context.filteredTools.read, "function");
    assert.equal(context.systemInstruction, hasExplicitMode ? "Cached prompt" : "");
    assert.equal(manager._pendingCache === null, hasExplicitMode);
  });
});
