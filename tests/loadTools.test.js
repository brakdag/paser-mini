import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import fs from "node:fs/promises";
import path from "node:path";
import LoadTools from "../src/tools/loadTools.js";

const loadTools = new LoadTools();
const testDir = path.resolve(process.cwd(), "tests/temp_load");

describe("loadTools", () => {
  before(async () => {
    await fs.mkdir(testDir, { recursive: true });
    await fs.writeFile(path.join(testDir, "a.js"), "content_a");
    await fs.writeFile(path.join(testDir, "b.json"), "content_b");
    await fs.writeFile(path.join(testDir, "c.md"), "content_c");
  });

  after(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it("should index files with extension filter", async () => {
    const result = JSON.parse(await loadTools.index("tests/temp_load", "js,json"));
    assert.strictEqual(result.total, 2);
    assert.ok(result.files.some((f) => f.path.endsWith("a.js")));
    assert.ok(result.files.some((f) => f.path.endsWith("b.json")));
  });

  it("should load files by IDs", async () => {
    const indexResult = JSON.parse(await loadTools.index("tests/temp_load"));
    const ids = indexResult.files.map((f) => f.id).join(",");
    
    const loaded = await loadTools.load(ids);
    assert.ok(loaded.includes("content_a"));
    assert.ok(loaded.includes("content_b"));
    assert.ok(loaded.includes("content_c"));
  });

  it("should throw on invalid IDs", async () => {
    await assert.rejects(
      async () => loadTools.load("abc"),
      /No valid IDs provided/,
    );
  });

  it("should throw on load without index", async () => {
    const freshLoadTools = new LoadTools();
    await assert.rejects(
      async () => freshLoadTools.load("0"),
      /No index available/,
    );
  });
});
