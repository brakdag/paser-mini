import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import MementoManager from "../src/tools/mementoManager.js";

/**
 * Returns the stored records of a log file, split by line.
 * @param {string} logFile - Path to the memento log.
 * @returns {Promise<string[]>} Non-empty lines.
 */
async function readRecords(logFile) {
  const content = await fs.readFile(logFile, "utf8");
  return content.split("\n").filter(Boolean);
}

describe("mementoManager", () => {
  let mementoManager;
  let tempDir;
  let logFile;

  before(async () => {
    // Isolated state: the suite must never read or delete the user's log.
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "paser-memento-"));
    logFile = path.join(tempDir, "memento.log");
    mementoManager = new MementoManager({ logDir: tempDir });
  });

  after(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it("should store a new memory entry", async () => {
    const result = await mementoManager.pushMemory("agent", "test", "First memory");
    assert.ok(result.includes("entry #1"));

    const content = await fs.readFile(logFile, "utf8");
    assert.ok(content.includes("First memory"));
  });

  it("should increment rank on referenced memory", async () => {
    // Own fixture: this case must not depend on the previous test's writes.
    const ownDir = await fs.mkdtemp(path.join(os.tmpdir(), "paser-memento-rank-"));
    const ownLog = path.join(ownDir, "memento.log");
    const own = new MementoManager({ logDir: ownDir });

    try {
      await own.pushMemory("agent", "test", "original");
      await own.pushMemory("agent", "test", "Second memory #1");
      const records = await readRecords(ownLog);

      assert.strictEqual(records.length, 2);
      assert.ok(records[0].includes("[Rank: 1]"), "referenced memory should have rank incremented");
      assert.ok(records[1].includes("[Rank: 0]"), "new memory starts at rank 0");
    } finally {
      await fs.rm(ownDir, { recursive: true, force: true });
    }
  });

  it("should record a multiline memory as a single entry with a stable ID", async () => {
    // Fresh fixture: this case must not depend on earlier tests.
    const ownDir = await fs.mkdtemp(path.join(os.tmpdir(), "paser-memento-multiline-"));
    const ownLog = path.join(ownDir, "memento.log");
    const own = new MementoManager({ logDir: ownDir });

    try {
      await own.pushMemory("agent", "test", "line one");
      await own.pushMemory("agent", "test", "multi\nline\nvalue");
      await own.pushMemory("agent", "test", "after");

      const records = await readRecords(ownLog);

      // One record per memory: no entry may span multiple lines.
      assert.strictEqual(records.length, 3, "each memory occupies exactly one line");

      const ids = records.map((line) => Number(line.match(/^\[ID: (\d+)\]/)[1]));
      assert.deepStrictEqual(ids, [1, 2, 3], "IDs are consecutive and not inflated by newlines");

      assert.ok(
        records[1].includes("multi\\nline\\nvalue"),
        "newlines are stored escaped so the record stays single-line",
      );
    } finally {
      await fs.rm(ownDir, { recursive: true, force: true });
    }
  });

  it("should not restart IDs at 1 for a large log", async () => {
    // Math.max(...ids) exceeded the argument limit on large logs; the failure
    // was swallowed and numbering restarted at 1, duplicating an existing ID.
    const ownDir = await fs.mkdtemp(path.join(os.tmpdir(), "paser-memento-large-"));
    const ownLog = path.join(ownDir, "memento.log");
    const own = new MementoManager({ logDir: ownDir });

    try {
      const lines = [];
      for (let i = 1; i <= 300000; i += 1) {
        lines.push(`[ID: ${i}] [2026-11-02 10:00:00] [Rank: 0] <general> seed`);
      }
      await fs.writeFile(ownLog, `${lines.join("\n")}\n`, "utf8");

      const result = await own.pushMemory("agent", "test", "after large log");
      assert.ok(
        result.includes("entry #300001"),
        `next ID must follow the highest existing ID, got: ${result}`,
      );

      const records = await readRecords(ownLog);
      const ids = records.map((line) => Number(line.match(/^\[ID: (\d+)\]/)[1]));
      assert.strictEqual(new Set(ids).size, ids.length, "no duplicated IDs");
    } finally {
      await fs.rm(ownDir, { recursive: true, force: true });
    }
  });

  it("should reject rather than restart numbering on a read failure", async () => {
    const ownDir = await fs.mkdtemp(path.join(os.tmpdir(), "paser-memento-err-"));
    const own = new MementoManager({ logDir: ownDir });
    const logPath = path.join(ownDir, "memento.log");

    try {
      // A directory at the log path yields EISDIR on read, not ENOENT.
      await fs.mkdir(logPath);
      await assert.rejects(
        () => own.pushMemory("agent", "test", "x"),
        (error) => error.code === "EISDIR" || /EISDIR/.test(error.message),
      );
    } finally {
      await fs.rm(ownDir, { recursive: true, force: true });
    }
  });

  it("should use ID 1 when the log does not exist", async () => {
    const ownDir = await fs.mkdtemp(path.join(os.tmpdir(), "paser-memento-new-"));
    const own = new MementoManager({ logDir: ownDir });
    try {
      const result = await own.pushMemory("agent", "test", "first");
      assert.ok(result.includes("entry #1"));
    } finally {
      await fs.rm(ownDir, { recursive: true, force: true });
    }
  });

  it("should count ranks per referenced ID, including multiline memories", async () => {
    const ownDir = await fs.mkdtemp(path.join(os.tmpdir(), "paser-memento-rank-"));
    const ownLog = path.join(ownDir, "memento.log");
    const own = new MementoManager({ logDir: ownDir });

    try {
      await own.pushMemory("agent", "test", "alpha\nbeta");
      await own.pushMemory("agent", "test", "references #1");
      const records = await readRecords(ownLog);

      assert.strictEqual(records.length, 2);
      assert.ok(records[0].includes("[ID: 1]"));
      assert.ok(records[0].includes("[Rank: 1]"), "multiline entry #1 is still referenceable");
      assert.ok(records[1].includes("[ID: 2]"));
    } finally {
      await fs.rm(ownDir, { recursive: true, force: true });
    }
  });
});
