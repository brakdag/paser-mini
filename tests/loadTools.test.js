import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import LoadTools from "../src/tools/loadTools.js";
import PathValidator from "../src/utils/pathValidator.js";

/**
 * Creates an independent project tree for indexing and filesystem fault tests.
 * @param {object} t Test context owning cleanup.
 * @param {object} [options] LoadTools dependency and limit overrides.
 * @returns {Promise<object>} Root, tools and a helper to populate the tree.
 */
async function fixture(t, options = {}) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "paser-load-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const tools = new LoadTools({ pathValidator: new PathValidator({ root }), ...options });
  return {
    root, tools,
    async write(relative, content = relative) {
      const target = path.join(root, relative);
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, content);
    },
  };
}

describe("loadTools", () => {
  let testDir;
  let relDir;

  before(async () => {
    // Unique directory per run: a fixed name would collide when the suite is
    // executed twice concurrently.
    testDir = await fs.mkdtemp(path.join(process.cwd(), "tests", "tmp-load-"));
    relDir = path.relative(process.cwd(), testDir);
    await fs.writeFile(path.join(testDir, "a.js"), "content_a");
    await fs.writeFile(path.join(testDir, "b.json"), "content_b");
    await fs.writeFile(path.join(testDir, "c.md"), "content_c");
  });

  after(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it("should index files with extension filter", async () => {
    const loadTools = new LoadTools();
    const result = JSON.parse(await loadTools.index(relDir, "js,json"));
    assert.strictEqual(result.total, 2);
    assert.ok(result.files.some((f) => f.path.endsWith("a.js")));
    assert.ok(result.files.some((f) => f.path.endsWith("b.json")));
  });

  it("should load files by IDs", async () => {
    // Own instance: an index cached by another test is not assumed to exist.
    const loadTools = new LoadTools();
    const indexResult = JSON.parse(await loadTools.index(relDir));
    const ids = indexResult.files.map((f) => f.id).join(",");

    const loaded = await loadTools.load(ids);
    assert.ok(loaded.includes("content_a"));
    assert.ok(loaded.includes("content_b"));
    assert.ok(loaded.includes("content_c"));
  });

  it("should throw on invalid IDs", async () => {
    const loadTools = new LoadTools();
    await loadTools.index(relDir);
    await assert.rejects(
      async () => loadTools.load("abc"),
      /No valid IDs provided/,
    );
  });

  it("should throw on load without index", async () => {
    const freshLoadTools = new LoadTools();
    await assert.rejects(
      async () => freshLoadTools.load("0"),
      /No index available/,
    );
  });

  it("honors globs, negations, anchoring, nested rules and excluded parent directories", async (t) => {
    const { tools, write } = await fixture(t);
    await write(".gitignore", "*.log\n!keep.log\n/root.txt\nblocked/\n!blocked/inside.txt\ncache/*\n!cache/keep/\n**/*.tmp\n\\#literal.txt\n");
    await write("sub/.gitignore", "!nested.log\nprivate.txt\n");
    const paths = [
      "drop.log", "keep.log", "root.txt", "sub/root.txt", "sub/drop.log", "sub/nested.log",
      "sub/private.txt", "blocked/inside.txt", "cache/drop.txt", "cache/keep/yes.txt", "sub/a.tmp",
      "#literal.txt", "visible.txt", "UPPER.LOG",
    ];
    await Promise.all(paths.map((name) => write(name)));
    const result = JSON.parse(await tools.index(".", "txt,log"));
    assert.deepStrictEqual(result.files.map((file) => file.path).sort(), [
      "UPPER.LOG", "cache/keep/yes.txt", "keep.log", "sub/nested.log", "sub/root.txt", "visible.txt",
    ]);
    assert.strictEqual(result.truncated, false);
    assert.deepStrictEqual(result.diagnostics, []);
    const sub = JSON.parse(await tools.index("sub", "txt,log"));
    assert.deepStrictEqual(sub.files.map((file) => file.path).sort(), ["sub/nested.log", "sub/root.txt"]);
    assert.strictEqual(JSON.parse(await tools.index("blocked")).total, 0);
  });

  it("always excludes internal metadata, even with negation or direct indexing", async (t) => {
    const { root, tools, write } = await fixture(t);
    await write(".gitignore", "!**/.git/**\n!**/.paser-mini/**\n");
    const directories = [".git", ".paser-mini", ".codex", ".agents", ".aws", "sub/.git"];
    await Promise.all(directories.map((dir) => write(`${dir}/secret.txt`)));
    await write("ordinary.txt", "public");
    await fs.symlink(path.join(root, ".git"), path.join(root, "alias"), "dir");
    assert.deepStrictEqual(JSON.parse(await tools.index(".", "txt")).files.map((file) => file.path), ["ordinary.txt"]);
    assert.strictEqual(JSON.parse(await tools.index("alias")).total, 0);
    assert.strictEqual(JSON.parse(await tools.index(".paser-mini")).total, 0);
  });

  it("refreshes ignore rules on every index and discards the previous index after a failed scan", async (t) => {
    const { tools, write } = await fixture(t);
    await write("file.txt", "visible");
    assert.strictEqual(JSON.parse(await tools.index(".", "txt")).total, 1);
    await write(".gitignore", "*.txt\n");
    assert.strictEqual(JSON.parse(await tools.index(".", "txt")).total, 0);
    await assert.rejects(tools.index("missing"), { code: "ENOENT" });
    await assert.rejects(tools.load("0"), /No index available/);
  });

  it("caps file counts, index JSON bytes, visited entries and depth with diagnostics", async (t) => {
    const { root, write } = await fixture(t);
    await Promise.all(Array.from({ length: 30 }, (_, i) => write(`${String(i).padStart(3, "0")}-${"x".repeat(100)}.txt`)));
    const policy = new PathValidator({ root });
    const files = JSON.parse(await new LoadTools({ pathValidator: policy, limits: { maxIndexFiles: 3 } }).index());
    assert.strictEqual(files.total, 3);
    assert.strictEqual(files.truncated, true);
    const output = await new LoadTools({ pathValidator: policy, limits: { maxIndexBytes: 2048 } }).index();
    assert.ok(Buffer.byteLength(output) <= 2048);
    assert.strictEqual(JSON.parse(output).truncated, true);
    const entries = JSON.parse(await new LoadTools({ pathValidator: policy, limits: { maxIndexEntries: 2 } }).index());
    assert.strictEqual(entries.total, 2);
    assert.ok(entries.diagnostics.some((diagnostic) => diagnostic.code === "ENTRY_LIMIT"));
    await write("deep/nested/file.txt");
    const depth = JSON.parse(await new LoadTools({ pathValidator: policy, limits: { maxDepth: 1 } }).index("deep"));
    assert.strictEqual(depth.total, 0);
    assert.ok(depth.diagnostics.some((diagnostic) => diagnostic.code === "DEPTH_LIMIT"));
  });

  it("keeps indexing other files when a listed file disappears", async (t) => {
    let root;
    const fileSystem = {
      ...fs,
      async lstat(filePath) {
        if (filePath === path.join(root, "gone.txt")) await fs.unlink(filePath);
        return fs.lstat(filePath);
      },
    };
    const context = await fixture(t, { fileSystem });
    ({ root } = context);
    await context.write("gone.txt");
    await context.write("keep.txt", "preserved");
    const result = JSON.parse(await context.tools.index(".", "txt"));
    assert.deepStrictEqual(result.files.map((file) => file.path), ["keep.txt"]);
    assert.ok(result.diagnostics.some((diagnostic) => diagnostic.path === "gone.txt" && diagnostic.code === "ENOENT"));
    assert.match(await context.tools.load("0"), /preserved/);
  });

  it("bounds diagnostics when many indexed files fail", async (t) => {
    const fileSystem = {
      ...fs,
      async lstat() { throw Object.assign(new Error("simulated denial"), { code: "EACCES" }); },
    };
    const { tools, write } = await fixture(t, { fileSystem });
    await Promise.all(Array.from({ length: 65 }, (_, i) => write(`${i}.txt`)));
    const result = JSON.parse(await tools.index(".", "txt"));
    assert.strictEqual(result.diagnostics.length, 50);
    assert.strictEqual(result.omittedDiagnostics, 15);
    assert.strictEqual(result.truncated, true);
  });

  it("keeps scanning when a listed directory disappears", async (t) => {
    const fileSystem = {
      ...fs,
      async opendir(directory) {
        if (path.basename(directory) === "gone-dir") await fs.rm(directory, { recursive: true });
        return fs.opendir(directory);
      },
    };
    const { tools, write } = await fixture(t, { fileSystem });
    await write("gone-dir/file.txt");
    await write("keep.txt", "preserved");
    const result = JSON.parse(await tools.index(".", "txt"));
    assert.deepStrictEqual(result.files.map((file) => file.path), ["keep.txt"]);
    assert.ok(result.diagnostics.some((diagnostic) => diagnostic.path === "gone-dir" && diagnostic.code === "ENOENT"));
  });

  it("loads surviving files while diagnosing deletions, changes, oversized files and missing IDs", async (t) => {
    const { root, tools, write } = await fixture(t);
    await write("keep.txt", "SURVIVOR");
    await write("gone.txt");
    await write("changed.txt", "old");
    await write("large.txt", "x".repeat(100 * 1024 + 1));
    const index = JSON.parse(await tools.index(".", "txt"));
    await fs.unlink(path.join(root, "gone.txt"));
    await write("changed.txt", "changed data must not load");
    const output = await tools.load(`${index.files.map((file) => file.id).join(",")},999`);
    assert.match(output, /SURVIVOR/);
    assert.match(output, /ENOENT/);
    assert.match(output, /FILE_CHANGED/);
    assert.match(output, /FILE_TOO_LARGE/);
    assert.match(output, /NOT_IN_INDEX/);
    assert.ok(!output.includes("changed data must not load"));
    assert.ok(output.endsWith("---çç--\n"));
  });

  it("rejects a file changed while reading and closes its handle", async (t) => {
    let changed = false;
    let closed = false;
    const fileSystem = {
      ...fs,
      async open(filePath, flags) {
        const handle = await fs.open(filePath, flags);
        return {
          stat() { return handle.stat(); },
          async read(...args) {
            const result = await handle.read(...args);
            if (!changed) {
              changed = true;
              await fs.writeFile(filePath, "replacement content");
            }
            return result;
          },
          async close() { closed = true; await handle.close(); },
        };
      },
    };
    const { tools, write } = await fixture(t, { fileSystem });
    await write("file.txt", "original");
    await tools.index(".", "txt");
    const output = await tools.load("0");
    assert.match(output, /FILE_CHANGED/);
    assert.ok(!output.includes("replacement content"));
    assert.ok(closed);
  });

  it("rejects replaced symlinks and preserves other content in the batch", async (t) => {
    const { root, tools, write } = await fixture(t);
    await write("changed.txt", "original");
    await write("keep.txt", "SURVIVOR");
    const index = JSON.parse(await tools.index(".", "txt"));
    await fs.unlink(path.join(root, "changed.txt"));
    await fs.symlink(path.join(root, "keep.txt"), path.join(root, "changed.txt"));
    const output = await tools.load(index.files.map((file) => file.id).join(","));
    assert.match(output, /Error/);
    assert.strictEqual(output.split("SURVIVOR").length - 1, 1);
  });

  it("reports open/read errors per file and closes failed reads without losing other parts", async (t) => {
    let closed = false;
    const fileSystem = {
      ...fs,
      async open(filePath, flags) {
        if (path.basename(filePath) === "denied.txt") {
          throw Object.assign(new Error("simulated denial"), { code: "EACCES" });
        }
        const handle = await fs.open(filePath, flags);
        if (path.basename(filePath) !== "broken.txt") return handle;
        return {
          stat() { return handle.stat(); },
          async read() { throw Object.assign(new Error("simulated read failure"), { code: "EIO" }); },
          async close() { closed = true; await handle.close(); },
        };
      },
    };
    const { tools, write } = await fixture(t, { fileSystem });
    await write("denied.txt");
    await write("broken.txt");
    await write("keep.txt", "SURVIVOR");
    const index = JSON.parse(await tools.index(".", "txt"));
    const output = await tools.load(index.files.map((file) => file.id).join(","));
    assert.match(output, /EACCES/);
    assert.match(output, /EIO/);
    assert.match(output, /SURVIVOR/);
    assert.ok(closed);
  });

  it("caps batch bytes including UTF-8 decoding, headers, diagnostics and closing boundary", async (t) => {
    const { tools, write } = await fixture(t, { limits: { maxBatchBytes: 2048, maxBatchFiles: 5 } });
    await write("one.txt", "á".repeat(300));
    await write("two.txt", Buffer.alloc(900, 255));
    const index = JSON.parse(await tools.index(".", "txt"));
    const output = await tools.load(index.files.map((file) => file.id).join(","));
    assert.ok(Buffer.byteLength(output) <= 2048);
    assert.match(output, /Batch truncated/);
    assert.ok(output.endsWith("---çç--\n"));
    await assert.rejects(tools.load("0,1,2,3,4,5"), /Batch exceeds 5/);
    await assert.rejects(tools.load("0,".repeat(1000)), /request too large/);
    await assert.rejects(tools.load("0junk"), /No valid IDs/);
    await assert.rejects(tools.load("9007199254740992"), /integer range/);
    const { id } = index.files.find((file) => file.path === "one.txt");
    const duplicate = await tools.load(`${id},${id}`);
    assert.strictEqual(duplicate.split(`Content-ID: ${id}`).length - 1, 1);
  });

  it("bounds ignore-file size and skips subtrees with unreadable rules", async (t) => {
    const { tools, write } = await fixture(t);
    await write("sub/.gitignore", "x".repeat(64 * 1024 + 1));
    await write("sub/hidden.txt", "must not load");
    await write("keep.txt");
    const result = JSON.parse(await tools.index(".", "txt"));
    assert.deepStrictEqual(result.files.map((file) => file.path), ["keep.txt"]);
    assert.ok(result.diagnostics.some((diagnostic) => diagnostic.code === "FILE_TOO_LARGE"));
  });
});
