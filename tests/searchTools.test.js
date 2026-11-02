import { describe, it } from "node:test";
import assert from "node:assert";
import fs from "node:fs/promises";
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

  it("continues matching when a listed directory disappears", async (t) => {
    t.mock.method(fs, "readdir", async (dir) => {
      if (dir === ".") {
        return [
          {
            name: "gone",
            /** @returns {boolean} Whether the entry is a directory. */
            isDirectory: () => true,
          },
          {
            name: "kept.json",
            /** @returns {boolean} Whether the entry is a directory. */
            isDirectory: () => false,
          },
        ];
      }
      throw Object.assign(new Error("Directory disappeared"), { code: "ENOENT" });
    });

    assert.deepStrictEqual(
      JSON.parse(await searchTools.searchFilesPatternFixed("*.json")),
      ["kept.json"],
    );
  });

  it("propagates directory access errors", async (t) => {
    t.mock.method(fs, "readdir", async () => {
      throw Object.assign(new Error("Access denied"), { code: "EACCES" });
    });

    await assert.rejects(
      () => searchTools.searchFilesPatternFixed("*.json"),
      { code: "EACCES" },
    );
  });
});
