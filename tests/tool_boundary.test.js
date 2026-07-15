import { test, describe, before, after } from "node:test";
import assert from "node:assert";
import fs from "node:fs/promises";
import path from "node:path";
import FileTools from "../src/tools/fileTools.js";

const fileTools = new FileTools();
const testDir = path.resolve(process.cwd(), "tests/temp_boundary");
const LIMIT = 100 * 1024;

describe("FileTools Boundary Evaluation", () => {
  before(async () => {
    await fs.mkdir(testDir, { recursive: true });
  });

  after(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  test("read should throw on files > 100KB", async () => {
    const filePath = path.join(testDir, "too_large.txt");
    await fs.writeFile(filePath, "A".repeat(LIMIT + 1));
    await assert.rejects(
      async () => fileTools.read(filePath),
      /File too large/,
    );
  });

  test("write should throw on content > 100KB", async () => {
    const filePath = path.join(testDir, "write_too_large.txt");
    await assert.rejects(
      async () => fileTools.write(filePath, "A".repeat(LIMIT + 1)),
      /Content too large/,
    );
  });

  test("tail should not throw for valid large files", async () => {
    const filePath = path.join(testDir, "tail_test.txt");
    await fs.writeFile(filePath, "A\n".repeat(10000));
    const result = await fileTools.tail(filePath, 10);
    assert.ok(typeof result === "string");
    assert.ok(result.length > 0);
  });
});
