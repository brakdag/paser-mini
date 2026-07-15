import { describe, it } from "node:test";
import assert from "node:assert";
import UtilTools from "../src/tools/utilTools.js";

const utilTools = new UtilTools();

describe("utilTools", () => {
  it("should validate valid JSON", async () => {
    const result = await utilTools.validateJson('{"a": 1}');
    assert.ok(result.includes("valid"));
  });

  it("should throw on invalid JSON", async () => {
    await assert.rejects(
      async () => utilTools.validateJson("not json"),
      /Invalid JSON/,
    );
  });
});
