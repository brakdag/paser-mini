import { describe, it } from "node:test";
import assert from "node:assert";
import BinaryTools from "../src/tools/binaryTools.js";

const binaryTools = new BinaryTools();

describe("binaryTools", () => {
  it("should handle invalid action", async () => {
    await assert.rejects(
      async () => binaryTools.handleHexCommand("unknown"),
      /Unsupported action/,
    );
  });
});
