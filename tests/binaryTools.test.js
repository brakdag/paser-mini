import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import BinaryTools from "../src/tools/binaryTools.js";

const binaryTools = new BinaryTools();
const testRoot = path.join(process.cwd(), "tests");

/**
 *
 * @param {(directory: string) => Promise<void>} run - Fixture assertions.
 */
async function withFixture(run) {
  const directory = await fs.mkdtemp(path.join(testRoot, "tmp-binary-"));
  try {
    await run(directory);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
}

describe("binaryTools", () => {
  it("rejects unsupported actions", async () => {
    await assert.rejects(binaryTools.handleHexCommand("unknown"), /Unsupported action/);
  });

  it("finds patterns at EOF and across a block boundary, including overlaps", async () => {
    await withFixture(async (directory) => {
      const source = path.join(directory, "source.bin");
      const data = Buffer.alloc(64 * 1024 + 8, 0x41);
      data.set([0xde, 0xad, 0xbe, 0xef], 64 * 1024 - 2);
      data.set([0xde, 0xad, 0xbe, 0xef], data.length - 4);
      await fs.writeFile(source, data);
      const result = await binaryTools.handleHexCommand("search", source, 0, 256, undefined, "LE", { pattern: "de ad be ef" });
      assert.deepEqual(result.offsets, [64 * 1024 - 2, data.length - 4]);
      assert.equal(result.count, 2);

      await fs.writeFile(source, Buffer.from([0xaa, 0xaa, 0xaa]));
      const overlapping = await binaryTools.handleHexCommand("search", source, 0, 256, undefined, "LE", { pattern: "aaaa" });
      assert.deepEqual(overlapping.offsets, [0, 1]);
    });
  });

  it("handles empty files, absent patterns, and patterns larger than a block", async () => {
    await withFixture(async (directory) => {
      const source = path.join(directory, "source.bin");
      await fs.writeFile(source, Buffer.alloc(0));
      assert.deepEqual(await binaryTools.handleHexCommand("search", source, 0, 256, undefined, "LE", { pattern: "00" }), { offsets: [], count: 0 });
      assert.deepEqual(await binaryTools.handleHexCommand("detect", source), { type: "Unknown", signature: null });
      await fs.writeFile(source, Buffer.from("there is no match"));
      assert.deepEqual(await binaryTools.handleHexCommand("search", source, 0, 256, undefined, "LE", { pattern: "ffff" }), { offsets: [], count: 0 });

      const longPattern = Buffer.alloc(64 * 1024 + 12, 0x7a);
      const file = Buffer.concat([Buffer.from("prefix"), longPattern, Buffer.from("suffix")]);
      await fs.writeFile(source, file);
      const result = await binaryTools.handleHexCommand("search", source, 0, 256, undefined, "LE", { pattern: longPattern.toString("hex") });
      assert.deepEqual(result.offsets, [6]);
      assert.equal(result.count, 1);
      assert.deepEqual((await binaryTools.handleHexCommand("search", source, 0, 256, undefined, "LE", { pattern: Buffer.alloc(128 * 1024, 0x7a).toString("hex") })).offsets, []);
    });
  });

  it("rejects malformed or excessive patterns and caps returned offsets", async () => {
    await withFixture(async (directory) => {
      const source = path.join(directory, "source.bin");
      await fs.writeFile(source, Buffer.alloc(10_020, 0));
      await Promise.all(["", "0", "0g", "00xx"].map((pattern) => (
        assert.rejects(binaryTools.handleHexCommand("search", source, 0, 256, undefined, "LE", { pattern }), /pattern must contain/)
      )));
      await assert.rejects(
        binaryTools.handleHexCommand("search", source, 0, 256, undefined, "LE", { pattern: Buffer.alloc(1024 * 1024 + 1).toString("hex") }),
        /exceeds/,
      );
      const capped = await binaryTools.handleHexCommand("search", source, 0, 256, undefined, "LE", { pattern: "00" });
      assert.equal(capped.count, 10_000);
      assert.equal(capped.truncated, true);
      assert.equal(capped.offsets.at(-1), 9_999);
    });
  });

  it("inspects only bytes read, preserves printable ASCII, and validates limits", async () => {
    await withFixture(async (directory) => {
      const source = path.join(directory, "source.bin");
      await fs.writeFile(source, Buffer.from([0x41, 0x20, 0x7e, 0x00, 0x80, 0x42]));
      const dump = await binaryTools.handleHexCommand("inspect", source, 0, 16);
      assert.match(dump, /41 20 7e 00 80 42/);
      assert.match(dump, /\| A ~\.\.B\n/);
      assert.doesNotMatch(dump, /00000006/);
      const atEof = await binaryTools.handleHexCommand("inspect", source, 6, 16);
      assert.match(atEof, /ASCII\n-{10,}\n$/);
      await assert.rejects(binaryTools.handleHexCommand("inspect", source, -1, 1), /offset must/);
      await assert.rejects(binaryTools.handleHexCommand("inspect", source, 0, 0), /length must/);
      await assert.rejects(binaryTools.handleHexCommand("inspect", source, 0, 65 * 1024), /inspection limit/);
      await assert.rejects(binaryTools.handleHexCommand("inspect", source, Number.MAX_SAFE_INTEGER + 1, 1), /offset must/);
    });
  });

  it("extracts exact ranges and rejects EOF overrun, invalid ranges, and output escapes", async () => {
    await withFixture(async (directory) => {
      const source = path.join(directory, "source.bin");
      const output = path.join(directory, "out.bin");
      await fs.writeFile(source, Buffer.from([1, 2, 3, 4]));
      await binaryTools.handleHexCommand("extract", source, 1, 256, 3, "LE", { outputFile: output });
      assert.deepEqual(await fs.readFile(output), Buffer.from([2, 3]));
      await assert.rejects(binaryTools.handleHexCommand("extract", source, 2, 5, undefined, "LE", { outputFile: output }), /extends beyond/);
      await assert.rejects(binaryTools.handleHexCommand("extract", source, 3, 256, 2, "LE", { outputFile: output }), /Invalid extraction range/);
      await assert.rejects(binaryTools.handleHexCommand("extract", source, 0, 256, undefined, "LE", { outputFile: "../escape.bin" }), /outside of project root/);
      await assert.rejects(binaryTools.handleHexCommand("extract", source, 0, 0, undefined, "LE", { outputFile: output }), /length must/);
    });
  });

  it("blocks input and output symlinks that resolve outside the project root", async () => {
    await withFixture(async (directory) => {
      const source = path.join(directory, "source.bin");
      const externalDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "binary-outside-"));
      const outsideFile = path.join(externalDirectory, "outside.bin");
      const inputLink = path.join(directory, "input-link");
      const outputLink = path.join(directory, "output-link");
      try {
        await fs.writeFile(source, Buffer.from([1, 2, 3]));
        await fs.writeFile(outsideFile, Buffer.from("sentinel"));
        await fs.symlink(outsideFile, inputLink);
        await fs.symlink(outsideFile, outputLink);
        await assert.rejects(binaryTools.handleHexCommand("detect", inputLink), /resolves outside/);
        await assert.rejects(binaryTools.handleHexCommand("extract", source, 0, 1, undefined, "LE", { outputFile: outputLink }), /resolves outside/);
        assert.equal(await fs.readFile(outsideFile, "utf8"), "sentinel");
      } finally {
        await fs.rm(externalDirectory, { recursive: true, force: true });
      }
    });
  });

  it("detects signatures from actual bytes and validates conversion widths", async () => {
    await withFixture(async (directory) => {
      const source = path.join(directory, "source.bin");
      await fs.writeFile(source, Buffer.from([0x25, 0x50, 0x44, 0x46]));
      assert.deepEqual(await binaryTools.handleHexCommand("detect", source), { type: "PDF", signature: "25504446" });
      assert.equal(await binaryTools.handleHexCommand("convert", undefined, 0, 256, undefined, "BE", { hexString: "01 02", type: "UInt16" }), 258);
      await assert.rejects(binaryTools.handleHexCommand("convert", undefined, 0, 256, undefined, "BE", { hexString: "01", type: "UInt16" }), /requires exactly 2/);
      await assert.rejects(binaryTools.handleHexCommand("convert", undefined, 0, 256, undefined, "BE", { hexString: "0z", type: "UInt8" }), /hexString must contain/);
    });
  });
});
