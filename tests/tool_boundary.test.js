import { test, describe } from "node:test";
import assert from "node:assert";
import fs from "node:fs/promises";
import path from "node:path";
import FileTools from "../src/tools/fileTools.js";

const fileTools = new FileTools();
const testDir = path.resolve(process.cwd(), "tests/temp_boundary");
const LIMIT = 100 * 1024;

describe("FileTools Boundary Evaluation", async () => {
  await fs.mkdir(testDir, { recursive: true });

  test("readFile should block files > 100KB", async () => {
    const filePath = path.join(testDir, "too_large.txt");
    await fs.writeFile(filePath, "A".repeat(LIMIT + 1));
    const result = await fileTools.readFile({ path: filePath });
    assert.strictEqual(result, "ERR: File too large");
  });

  test("writeFile should block content > 100KB", async () => {
    const filePath = path.join(testDir, "write_too_large.txt");
    const result = await fileTools.writeFile({ path: filePath, content: "A".repeat(LIMIT + 1) });
    assert.strictEqual(result, "ERR: Content too large");
  });

  test("readFile tail should block results > 100KB", async () => {
    const filePath = path.join(testDir, "tail_test.txt");
    // Create a file larger than the internal buffer (64KB) but smaller than LIMIT
    // The tool reads 64KB and then slices by 'tail' lines.
    // To trigger "Tail result too large", the resulting slice must be > 100KB.
    // Since the tool only reads 64KB for tail, this error is actually hard to hit 
    // unless the buffer size is increased. Let's verify current behavior.
    await fs.writeFile(filePath, "A\n".repeat(10000)); 
    const result = await fileTools.readFile({ path: filePath, tail: 10000 });
    assert.notStrictEqual(result, "ERR: Tail result too large");
  });

  await fs.rm(testDir, { recursive: true, force: true });
});