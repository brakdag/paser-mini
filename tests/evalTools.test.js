import { describe, it } from "node:test";
import assert from "node:assert";
import EvalTools from "../src/tools/evalTools.js";

const evalTools = new EvalTools();

describe("evalTools", () => {
  it("should execute simple JS", () => {
    const result = evalTools.executeJS("1 + 1");
    const output = JSON.parse(result);
    assert.strictEqual(output.result, 2);
  });
});
