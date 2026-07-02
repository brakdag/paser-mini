import { describe, it } from "node:test";
import assert from "node:assert";
import { SearchTools } from "../src/tools/searchTools.js";

const searchTools = new SearchTools();

describe("searchTools", () => {
  it("should return empty array for empty query", async () => {
    const result = await searchTools.searchText({ query: "" });
    assert.strictEqual(result, "[]");
  });
});
