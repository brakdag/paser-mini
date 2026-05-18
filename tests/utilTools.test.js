import { describe, it } from "node:test";
import assert from "node:assert";
import { UtilTools } from "../src/tools/utilTools.js";

const utilTools = new UtilTools();

describe("utilTools", () => {
  it("should validate valid JSON", async () => {
    const result = await utilTools.validateJson({ json_string: '{"a": 1}' });
    assert.strictEqual(result, "El JSON es valido.");
  });
});
