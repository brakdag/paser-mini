import { test, describe } from "node:test";
import assert from "node:assert";
import SmartToolParser from "../src/core/smartParser.js";
import ExecutionEngine from "../src/core/executionEngine.js";

/**
 * Builds a parser → engine pipeline whose tools record how they were invoked.
 * @param {string[]} names Tool names to expose.
 * @returns {{calls: Array, engine: ExecutionEngine, parser: SmartToolParser}} Harness.
 */
function harness(names) {
  const calls = [];
  const tools = {};
  names.forEach((name) => {
    /**
     * Records one invocation of the stub tool.
     * @param {...unknown} args Arguments the engine passed.
     * @returns {Promise<string>} Fixed success value.
     */
    tools[name] = async (...args) => {
      calls.push({ name, args });
      return "ok";
    };
  });
  const ui = {
    bashEnabled: true,
    startToolMonitoring() {},
    endToolMonitoring() {},
  };
  const parser = new SmartToolParser();
  const engine = new ExecutionEngine({}, tools, parser, ui);
  return { calls, engine, parser };
}

/**
 * Runs a delimited tool call through extraction, parsing and the engine.
 * @param {{engine: ExecutionEngine, parser: SmartToolParser}} h Harness.
 * @param {string} raw Raw call source without delimiters.
 * @returns {Promise<object>} Engine result.
 */
async function run(h, raw) {
  const [{ data, error }] = h.parser.extractToolCalls(`Ə${raw}`);
  if (error) return { success: false, result: error };
  return h.engine.executeToolCall(data.name, data.args);
}

describe("parser to engine argument contract", () => {
  test("schema defaults reach the invoked function", async () => {
    const h = harness(["eslint"]);
    const res = await run(h, "eslint()");
    assert.strictEqual(res.success, true);
    assert.deepStrictEqual(h.calls, [{ name: "eslint", args: ["."] }]);
  });

  test("schema transforms reach the invoked function", async () => {
    const h = harness(["url"]);
    const res = await run(h, 'url("example.com")');
    assert.strictEqual(res.success, true);
    assert.deepStrictEqual(h.calls[0].args, ["https://example.com"]);
  });

  test("optional middle parameters keep later arguments in their slot", async () => {
    const h = harness(["bin"]);
    const res = await run(h, 'bin("inspect","f.bin",0,undefined,undefined,"BE")');
    assert.strictEqual(res.success, true);
    assert.deepStrictEqual(h.calls[0].args, [
      "inspect",
      "f.bin",
      0,
      undefined,
      undefined,
      "BE",
    ]);
  });

  test("declared parameter order wins over caller key order", async () => {
    const h = harness(["replace"]);
    const res = await h.engine.executeToolCall("replace", {
      replace_text: "b", path: "a.txt", search_text: "a",
    });
    assert.strictEqual(res.success, true);
    assert.deepStrictEqual(h.calls[0].args, ["a.txt", "a", "b"]);
  });

  test("surplus arguments never reach the function", async () => {
    const h = harness(["execute"]);
    const res = await run(h, 'execute("ls","extra")');
    assert.strictEqual(res.success, false);
    assert.match(res.result, /accepts at most 1 arguments, got 2/);
    assert.deepStrictEqual(h.calls, []);
  });

  test("multiple statements never reach the function", async () => {
    const h = harness(["read"]);
    const res = await run(h, 'read("a"); read("b")');
    assert.strictEqual(res.success, false);
    assert.deepStrictEqual(h.calls, []);
  });

  test("unsupported expressions never reach a writing tool", async () => {
    const h = harness(["write"]);
    const res = await run(h, 'write("a.txt", "a" + "b")');
    assert.strictEqual(res.success, false);
    assert.deepStrictEqual(h.calls, []);
  });

  test("unknown tools are refused before invocation", async () => {
    const h = harness(["read"]);
    const res = await run(h, 'nope("x")');
    assert.strictEqual(res.success, false);
    assert.match(res.result, /Unknown tool: nope/);
    assert.deepStrictEqual(h.calls, []);
  });

  test("inherited executable names are refused by the engine", async () => {
    const h = harness(["read"]);
    const res = await h.engine.executeToolCall("constructor", {});
    assert.strictEqual(res.success, false);
    assert.match(res.result, /Unknown tool: constructor/);
    assert.deepStrictEqual(h.calls, []);
  });

  test("a validation failure never reaches the function", async () => {
    const h = harness(["execute"]);
    const res = await run(h, "execute()");
    assert.strictEqual(res.success, false);
    assert.match(res.result, /^Validation: command: Required/);
    assert.deepStrictEqual(h.calls, []);
  });
});
