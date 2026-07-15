import { describe, it } from "node:test";
import assert from "node:assert";
import FountainTools from "../src/tools/fountainTools.js";

const fountainTools = new FountainTools();

describe("fountainTools", () => {
  it("should format scene correctly", async () => {
    const result = await fountainTools.insertSceneFountain("test", "do something");
    assert.strictEqual(result.type, "FOUNTAIN_INJECTION");
    assert.ok(result.content.includes("* SCENE: TEST"));
  });
});
