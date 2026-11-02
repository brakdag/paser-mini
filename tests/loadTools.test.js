import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import fs from "node:fs/promises";
import path from "node:path";
import LoadTools from "../src/tools/loadTools.js";

describe("loadTools", () => {
  let testDir;
  let relDir;

  before(async () => {
    // Unique directory per run: a fixed name would collide when the suite is
    // executed twice concurrently.
    testDir = await fs.mkdtemp(path.join(process.cwd(), "tests", "tmp-load-"));
    relDir = path.relative(process.cwd(), testDir);
    await fs.writeFile(path.join(testDir, "a.js"), "content_a");
    await fs.writeFile(path.join(testDir, "b.json"), "content_b");
    await fs.writeFile(path.join(testDir, "c.md"), "content_c");
  });

  after(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it("should index files with extension filter", async () => {
    const loadTools = new LoadTools();
    const result = JSON.parse(await loadTools.index(relDir, "js,json"));
    assert.strictEqual(result.total, 2);
    assert.ok(result.files.some((f) => f.path.endsWith("a.js")));
    assert.ok(result.files.some((f) => f.path.endsWith("b.json")));
  });

  it("should load files by IDs", async () => {
    // Own instance: an index cached by another test is not assumed to exist.
    const loadTools = new LoadTools();
    const indexResult = JSON.parse(await loadTools.index(relDir));
    const ids = indexResult.files.map((f) => f.id).join(",");

    const loaded = await loadTools.load(ids);
    assert.ok(loaded.includes("content_a"));
    assert.ok(loaded.includes("content_b"));
    assert.ok(loaded.includes("content_c"));
  });

  it("should throw on invalid IDs", async () => {
    const loadTools = new LoadTools();
    await loadTools.index(relDir);
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
