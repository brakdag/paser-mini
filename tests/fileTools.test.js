import { test, describe, before, after } from "node:test";
import assert from "node:assert";
import FileTools from "../src/tools/fileTools.js";

const fileTools = new FileTools();
const testDir = "tests/temp_file_tools";

describe("fileTools", () => {
  before(async () => {
    await fileTools.mkdir(testDir);
  });

  after(async () => {
    await fileTools.remove(testDir);
  });

  test("write and read", async () => {
    const filePath = `${testDir}/test.txt`;
    const content = "hello world";

    await fileTools.write(filePath, content);

    const readResult = await fileTools.read(filePath);
    assert.strictEqual(readResult, content);
  });

  test("list", async () => {
    const result = await fileTools.list(testDir);
    assert.ok(result.includes("test.txt"));
  });

  test("replace", async () => {
    const filePath = `${testDir}/replace_test.txt`;
    await fileTools.write(filePath, "original content");
    await fileTools.replace(filePath, "original", "replaced");
    const result = await fileTools.read(filePath);
    assert.strictEqual(result, "replaced content");
  });

  test("tail", async () => {
    const filePath = `${testDir}/tail_test.txt`;
    const lines = ["line1\n", "line2\n", "line3\n", "line4\n", "line5\n"];
    await fileTools.write(filePath, lines.join(""));
    const result = await fileTools.tail(filePath, 2);
    assert.ok(result.includes("line5"));
  });

  test("concat", async () => {
    const filePath = `${testDir}/concat_test.txt`;
    await fileTools.write(filePath, "first ");
    await fileTools.concat(filePath, "second");
    const result = await fileTools.read(filePath);
    assert.strictEqual(result, "first second");
  });

  test("copy", async () => {
    const src = `${testDir}/copy_src.txt`;
    const dest = `${testDir}/copy_dest.txt`;
    await fileTools.write(src, "copy me");
    await fileTools.copy(src, dest);
    const result = await fileTools.read(dest);
    assert.strictEqual(result, "copy me");
  });

  test("rename", async () => {
    const oldPath = `${testDir}/rename_old.txt`;
    const newPath = `${testDir}/rename_new.txt`;
    await fileTools.write(oldPath, "move me");
    await fileTools.rename(oldPath, newPath);
    const result = await fileTools.read(newPath);
    assert.strictEqual(result, "move me");
  });
});
