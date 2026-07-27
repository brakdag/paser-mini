import { describe, it } from "node:test";
import assert from "node:assert";
import EvalTools from "../src/tools/evalTools.js";

const evalTools = new EvalTools();

describe("evalTools", () => {
  it("should execute simple JS", async () => {
    const result = await evalTools.executeJS("1 + 1");
    const output = JSON.parse(result);
    assert.strictEqual(output.result, 2);
  });

  it("should handle top-level await", async () => {
    const code = "const res = await Promise.resolve(42); return res;";
    const result = await evalTools.executeJS(code);
    const output = JSON.parse(result);
    assert.strictEqual(output.result, 42);
  });
});
