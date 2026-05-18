import { describe, it } from "node:test";
import assert from "node:assert";
import { MemoryTools } from "../src/tools/memoryTools.js";

const memoryTools = new MemoryTools();

describe("memoryTools", () => {
  it("should return error if not initialized", async () => {
    const result = await memoryTools.getTokenCount();
    assert.strictEqual(result, "ERR: Memory context not initialized.");
  });
});
