import { describe, it } from "node:test";
import assert from "node:assert";
import MemoryTools from "../src/tools/memoryTools.js";

const memoryTools = new MemoryTools();

describe("memoryTools", () => {
  it("should throw if not initialized", async () => {
    await assert.rejects(
      async () => memoryTools.getTokenCount(),
      /Memory context not initialized/,
    );
  });
});
