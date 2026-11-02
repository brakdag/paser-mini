import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import fs from "node:fs/promises";
import path from "node:path";
import JSZip from "jszip";
import ZipTools from "../src/tools/zipTools.js";

describe("zipTools", () => {
  let testDir;
  let zipPath;

  before(async () => {
    testDir = await fs.mkdtemp(path.join(process.cwd(), "tests", "tmp-zip-"));
    zipPath = path.join(testDir, "test.zip");

    const zip = new JSZip();
    zip.file("hello.txt", "Hello World");
    zip.folder("nested").file("data.json", '{"key":"value"}');

    const content = await zip.generateAsync({ type: "nodebuffer" });
    await fs.writeFile(zipPath, content);
  });

  after(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it("should list contents of a valid zip", async () => {
    const zipTools = new ZipTools();
    const result = JSON.parse(await zipTools.listContents(zipPath));
    assert.ok(result.files.includes("hello.txt"));
    assert.ok(result.files.includes("nested/data.json"));
  });

  it("should throw on non-existent file", async () => {
    const zipTools = new ZipTools();
    await assert.rejects(
      async () => zipTools.listContents(path.join(testDir, "non_existent.zip")),
    );
  });
});
