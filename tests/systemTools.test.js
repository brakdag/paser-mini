import { describe, it } from "node:test";
import assert from "node:assert";
import { SystemTools } from "../src/tools/systemTools.js";

const systemTools = new SystemTools();

describe("systemTools", () => {
  it("should execute a simple bash command", async () => {
    const result = await systemTools.executeBash({ command: "echo hello" });
    assert.strictEqual(result.trim(), "hello");
  });
});
