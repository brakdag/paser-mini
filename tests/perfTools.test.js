import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import fs from "node:fs/promises";
import path from "node:path";
import PerfTools from "../src/tools/perfTools.js";

describe("perfTools", () => {
  let testDir;

  before(async () => {
    testDir = await fs.mkdtemp(path.join(process.cwd(), "tests", "tmp-perf-"));
  });

  after(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it("should return metrics as valid JSON", async () => {
    const perfTools = new PerfTools();
    const result = JSON.parse(await perfTools.metrics());
    assert.ok(result.memory);
    assert.ok(result.cpu);
    assert.ok(result.uptime);
    assert.ok(typeof result.memory.rss === "string");
  });

  it("should write heap snapshot to disk", async () => {
    const perfTools = new PerfTools();
    const snapshotPath = path.relative(process.cwd(), path.join(testDir, "snapshot.heapsnapshot"));
    const result = await perfTools.snapshot(snapshotPath);
    assert.ok(result.includes("Heap snapshot written to"));

    const stats = await fs.stat(path.join(testDir, "snapshot.heapsnapshot"));
    assert.ok(stats.size > 0);
  });

  it("should throw on missing path", async () => {
    const perfTools = new PerfTools();
    await assert.rejects(
      async () => perfTools.snapshot(),
      /'path' parameter is required/,
    );
  });
});
