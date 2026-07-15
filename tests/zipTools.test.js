import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import fs from "node:fs/promises";
import path from "node:path";
import JSZip from "jszip";
import ZipTools from "../src/tools/zipTools.js";

const zipTools = new ZipTools();
const testDir = path.resolve(process.cwd(), "tests/temp_zip");
const zipPath = path.join(testDir, "test.zip");

describe("zipTools", () => {
  before(async () => {
    await fs.mkdir(testDir, { recursive: true });
    
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
    const result = JSON.parse(await zipTools.listContents(zipPath));
    assert.ok(result.files.includes("hello.txt"));
    assert.ok(result.files.includes("nested/data.json"));
  });

  it("should throw on non-existent file", async () => {
    await assert.rejects(
      async () => zipTools.listContents("non_existent.zip"),
    );
  });
});
