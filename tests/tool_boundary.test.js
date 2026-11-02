import { test, describe, before, after } from "node:test";
import assert from "node:assert";
import fs from "node:fs/promises";
import path from "node:path";
import FileTools from "../src/tools/fileTools.js";

const fileTools = new FileTools();
const LIMIT = 100 * 1024;

describe("FileTools Boundary Evaluation", () => {
  let testDir;

  before(async () => {
    testDir = await fs.mkdtemp(path.join(process.cwd(), "tests", "tmp-boundary-"));
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

  test("tail should return the requested lines for large files", async () => {
    const filePath = path.join(testDir, "tail_test.txt");
    const lines = [];
    for (let i = 0; i < 10000; i += 1) {
      lines.push(`row-${i}`);
    }
    await fs.writeFile(filePath, `${lines.join("\n")}\n`);
    const result = await fileTools.tail(filePath, 10);
    assert.strictEqual(result, lines.slice(-10).join("\n"));
  });
});
