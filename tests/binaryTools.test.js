import { describe, it } from "node:test";
import assert from "node:assert";
import { BinaryTools } from "../src/tools/binaryTools.js";

const binaryTools = new BinaryTools();

describe("binaryTools", () => {
  it("should handle invalid action", async () => {
    const result = await binaryTools.handleHexCommand({ action: "unknown" });
    assert.strictEqual(result.success, false);
    assert.ok(result.error.includes("Unsupported action"));
  });
});
