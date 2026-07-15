import { describe, it } from "node:test";
import assert from "node:assert";
import SearchTools from "../src/tools/searchTools.js";

const searchTools = new SearchTools();

describe("searchTools", () => {
  it("should return empty array for empty query", async () => {
    const result = await searchTools.searchText("");
    assert.strictEqual(result, "[]");
  });

  it("should return JSON array for valid query", async () => {
    const result = await searchTools.searchFilesPatternFixed("*.json");
    const parsed = JSON.parse(result);
    assert.ok(Array.isArray(parsed));
  });
});
