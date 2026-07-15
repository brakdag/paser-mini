import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import fs from "node:fs/promises";
import path from "node:path";
import MementoManager from "../src/tools/mementoManager.js";

const LOG_DIR = path.join(process.cwd(), ".paser-mini", "log");
const LOG_FILE = path.join(LOG_DIR, "memento.log");

describe("mementoManager", () => {
  let mementoManager;

  before(async () => {
    await fs.rm(LOG_FILE, { force: true });
    mementoManager = new MementoManager();
  });

  after(async () => {
    await fs.rm(LOG_FILE, { force: true });
  });

  it("should store a new memory entry", async () => {
    const result = await mementoManager.pushMemory("agent", "test", "First memory");
    assert.ok(result.includes("entry #1"));
    
    const content = await fs.readFile(LOG_FILE, "utf8");
    assert.ok(content.includes("First memory"));
  });

  it("should increment rank on referenced memory", async () => {
    await mementoManager.pushMemory("agent", "test", "Second memory #1");
    const content = await fs.readFile(LOG_FILE, "utf8");
    const lines = content.split("\n").filter(Boolean);
    
    const firstEntry = lines[0];
    assert.ok(firstEntry.includes("[Rank: 1]"), "Referenced memory should have rank incremented");
  });
});
