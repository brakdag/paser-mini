import { test } from "node:test";
import assert from "node:assert/strict";
import validator from "../src/core/schemaRegistry.js";
import SmartToolParser from "../src/core/smartParser.js";
import { createTools, generateSystemInstruction } from "../src/infrastructure/registry.js";
import ExecutionEngine from "../src/core/executionEngine.js";
import TOOL_DEFINITIONS from "../src/infrastructure/toolDefinitions.js";

const cases = [
  { name: "restore", legacy: { filepath: "old.txt" }, canonical: { path: "old.txt" }, call: 'restore("old.txt")' },
  { name: "zip", legacy: { filePath: "a.zip" }, canonical: { path: "a.zip" }, call: 'zip("a.zip")' },
  { name: "bin", legacy: { action: "inspect", filePath: "a.bin" }, canonical: { action: "inspect", path: "a.bin" }, call: 'bin("inspect","a.bin")' },
  ...["structure", "node", "arrange", "update"].map(name => ({
    name,
    legacy: { file_path: "a.json", path: "items", ...(name === "update" ? { value: 7 } : {}) },
    canonical: { filePath: "a.json", nodePath: "items", ...(name === "update" ? { value: 7 } : {}) },
    call: `${name}("a.json","items"${name === "update" ? ",7" : ""})`,
  })),
];

cases.forEach(({ name, legacy, canonical, call }) => {
  test(`${name} preserves positional calls and converts legacy named arguments`, async () => {
    const parser = new SmartToolParser();
    const old = validator.validate(name, Object.freeze(legacy));
    const current = validator.validate(name, canonical);
    assert.equal(old.isValid, true, old.errors.join("; "));
    assert.deepEqual(old.correctedArgs, canonical);
    assert.deepEqual(current.correctedArgs, canonical);
    assert.deepEqual(parser.parseCall(call), { data: { name, args: canonical }, error: null });
    const invocations = [];
    const tools = createTools(async () => ({
      [TOOL_DEFINITIONS[name].method](...args) { invocations.push(args); return "ok"; },
    }));
    const engine = new ExecutionEngine(tools, parser, {
      bashEnabled: false, startToolMonitoring() {}, endToolMonitoring() {},
    });
    assert.equal((await engine.executeToolCall(name, legacy)).success, true);
    assert.equal((await engine.executeToolCall(name, canonical)).success, true);
    assert.deepEqual(invocations[0], invocations[1]);
    assert.deepEqual(validator.validate(name, { ...legacy, ...canonical }).correctedArgs, canonical);
  });
});

test("conflicting destinations and unknown fields are rejected before tool execution", () => {
  /** @type {Array<[string, object]>} */
  const conflicts = [
    ["restore", { path: "a", filepath: "b" }],
    ["zip", { path: "a", filePath: "b" }],
    ["bin", { action: "inspect", path: "a", filePath: "b" }],
    ["node", { filePath: "a", file_path: "b", nodePath: "items" }],
    ["node", { filePath: "a", nodePath: "items", path: "other" }],
  ];
  conflicts.forEach(([name, args]) => {
    const result = validator.validate(name, args);
    assert.equal(result.isValid, false);
    assert.match(result.errors.join("; "), /Conflicting arguments/);
  });
  assert.equal(validator.validate("zip", { path: "a", unexpected: true }).isValid, false);
});

test("generated catalog advertises canonical path names and accurate execution limits", () => {
  const prompt = generateSystemInstruction(["restore", "zip", "bin", "node", "token", "run"]);
  ["restore(path)", "zip(path)", "bin(action,path,", "node(filePath,nodePath)"].forEach(signature => {
    assert.ok(prompt.includes(signature), signature);
  });
  assert.match(prompt, /Estimated token usage/);
  assert.match(prompt, /disposable Linux sandbox/);
});
