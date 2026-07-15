import { describe, it, after } from "node:test";
import assert from "node:assert";
import fs from "node:fs/promises";
import PerfTools from "../src/tools/perfTools.js";

const perfTools = new PerfTools();
const snapshotPath = "tests/temp_snapshot.heapsnapshot";

describe("perfTools", () => {
  after(async () => {
    await fs.rm(snapshotPath, { force: true });
  });

  it("should return metrics as valid JSON", async () => {
    const result = JSON.parse(await perfTools.metrics());
    assert.ok(result.memory);
    assert.ok(result.cpu);
    assert.ok(result.uptime);
    assert.ok(typeof result.memory.rss === "string");
  });

  it("should write heap snapshot to disk", async () => {
    const result = await perfTools.snapshot(snapshotPath);
    assert.ok(result.includes("Heap snapshot written to"));
    
    const stats = await fs.stat(snapshotPath);
    assert.ok(stats.size > 0);
  });

  it("should throw on missing filepath", async () => {
    await assert.rejects(
      async () => perfTools.snapshot(),
      /'filepath' parameter is required/,
    );
  });
});
