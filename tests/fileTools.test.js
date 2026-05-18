import { test, describe, after } from "node:test";
import assert from "node:assert";
import fs from "node:fs/promises";
import path from "node:path";
import { FileTools } from "../src/tools/fileTools.js";

const fileTools = new FileTools();
const testDir = path.resolve(process.cwd(), "tests/temp_file_tools");

describe("fileTools", async () => {
  await fileTools.createDir({ path: "tests/temp_file_tools" });

  after(async () => {
    await fileTools.removeFile({ path: "tests/temp_file_tools" });
  });

  test("writeFile and readFile", async () => {
    const filePath = "tests/temp_file_tools/test.txt";
    const content = "hello world";

    const writeResult = await fileTools.writeFile({ path: filePath, content });
    assert.strictEqual(writeResult, "OK");

    const readResult = await fileTools.readFile({ path: filePath });
    assert.strictEqual(readResult, content);
  });
});
