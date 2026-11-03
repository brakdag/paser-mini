import { test, describe, before, after } from "node:test";
import assert from "node:assert";
import fs from "node:fs/promises";
import path from "node:path";
import FileTools from "../src/tools/fileTools.js";

const fileTools = new FileTools();

describe("fileTools", () => {
  let testDir;

  before(async () => {
    // Unique directory inside the project root: PathValidator bounds every
    // operation to the root, and a unique name keeps parallel runs isolated.
    testDir = await fs.mkdtemp(path.join(process.cwd(), "tests", "tmp-filetools-"));
  });

  after(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  /**
   * Maps a fixture name to a path relative to the project root.
   * Every test creates its own fixture; none depends on another test's writes.
   * @param {string} name - File name inside the fixture directory.
   * @returns {string} Path relative to the working directory.
   */
  const rel = (name) => path.relative(process.cwd(), path.join(testDir, name));

  test("write and read", async () => {
    const filePath = rel("read_write.txt");
    const content = "hello world";

    await fileTools.write(filePath, content);
    assert.strictEqual(await fileTools.read(filePath), content);
  });

  test("list", async () => {
    await fileTools.write(rel("listed.txt"), "x");
    const result = await fileTools.list(rel("."));
    assert.ok(result.includes("listed.txt"));
  });

  test("replace", async () => {
    const filePath = rel("replace_test.txt");
    await fileTools.write(filePath, "original content");
    await fileTools.replace(filePath, "original", "replaced");
    assert.strictEqual(await fileTools.read(filePath), "replaced content");
  });

  test("replace rejects ambiguous matches", async () => {
    const filePath = rel("replace_ambiguous.txt");
    await fileTools.write(filePath, "dup dup");
    await assert.rejects(
      () => fileTools.replace(filePath, "dup", "x"),
      /Multiple results/,
    );
  });

  test("concat appends source file contents and leaves source intact", async () => {
    const filePath = rel("concat_test.txt");
    const sourcePath = rel("concat_source.txt");
    await fileTools.write(filePath, "first ");
    await fileTools.write(sourcePath, "second");
    await fileTools.concat(filePath, sourcePath);
    assert.strictEqual(await fileTools.read(filePath), "first second");
    assert.strictEqual(await fileTools.read(sourcePath), "second");
  });

  test("concat validates source and size before changing destination", async () => {
    const destination = rel("concat_unchanged.txt");
    await fileTools.write(destination, "original");
    await assert.rejects(() => fileTools.concat(destination, rel("missing.txt")), /ENOENT/);
    await assert.rejects(() => fileTools.concat(destination, destination), /itself/);
    const source = rel("concat_large.txt");
    await fileTools.write(source, "x".repeat(100 * 1024));
    await assert.rejects(() => fileTools.concat(destination, source), /too large/);
    assert.strictEqual(await fileTools.read(destination), "original");
  });

  test("copy", async () => {
    const src = rel("copy_src.txt");
    const dest = rel("copy_dest.txt");
    await fileTools.write(src, "copy me");
    await fileTools.copy(src, dest);
    assert.strictEqual(await fileTools.read(dest), "copy me");
  });

  test("rename", async () => {
    const oldPath = rel("rename_old.txt");
    const newPath = rel("rename_new.txt");
    await fileTools.write(oldPath, "move me");
    await fileTools.rename(oldPath, newPath);
    assert.strictEqual(await fileTools.read(newPath), "move me");
  });

  test("remove deletes a file", async () => {
    const filePath = rel("remove_me.txt");
    await fileTools.write(filePath, "bye");
    await fileTools.remove(filePath);
    await assert.rejects(() => fileTools.read(filePath), /ENOENT/);
  });
});

describe("fileTools.tail contract", () => {
  let testDir;

  before(async () => {
    testDir = await fs.mkdtemp(path.join(process.cwd(), "tests", "tmp-tail-"));
  });

  after(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  /**
   * Maps a fixture name to a path relative to the project root.
   * @param {string} name - File name inside the fixture directory.
   * @returns {string} Path relative to the working directory.
   */
  const rel = (name) => path.relative(process.cwd(), path.join(testDir, name));

  /**
   * Writes content and returns its tail. A per-case file keeps cases
   * independent of each other and of execution order.
   * @param {string} name - File name inside the fixture directory.
   * @param {string} content - Content to write.
   * @param {number} count - Number of trailing lines wanted.
   * @returns {Promise<string>} The tailed content.
   */
  const tailOf = async (name, content, count) => {
    const filePath = rel(name);
    await fileTools.write(filePath, content);
    return fileTools.tail(filePath, count);
  };

  test("file with a final newline", async () => {
    const result = await tailOf("final-newline.txt", "line1\nline2\nline3\nline4\nline5\n", 2);
    assert.strictEqual(result, "line4\nline5");
  });

  test("file without a final newline", async () => {
    const result = await tailOf("no-final-newline.txt", "line1\nline2\nline3\nline4\nline5", 2);
    assert.strictEqual(result, "line4\nline5");
  });

  test("empty file", async () => {
    assert.strictEqual(await tailOf("empty.txt", "", 2), "");
  });

  test("file containing only a newline", async () => {
    assert.strictEqual(await tailOf("only-newline.txt", "\n", 2), "");
  });

  test("preserves consecutive empty lines", async () => {
    assert.strictEqual(await tailOf("empty-lines.txt", "\n\n", 2), "\n");
    assert.strictEqual(await tailOf("empty-last-line.txt", "first\n\n", 2), "first\n");
  });

  test("returns an empty final line after a large prefix", async () => {
    const filePath = path.join(testDir, "large-empty-last-line.txt");
    await fs.writeFile(filePath, `${"x".repeat(300000)}\n\n`, "utf8");

    assert.strictEqual(await fileTools.tail(rel("large-empty-last-line.txt"), 1), "");
    await assert.rejects(
      () => fileTools.tail(rel("large-empty-last-line.txt"), 2),
      /Tail result too large/,
    );
  });

  test("single line without newline", async () => {
    assert.strictEqual(await tailOf("single.txt", "only", 3), "only");
  });

  test("single line with newline", async () => {
    assert.strictEqual(await tailOf("single-nl.txt", "only\n", 3), "only");
  });

  test("count larger than available lines", async () => {
    const result = await tailOf("few.txt", "a\nb\nc\n", 10);
    assert.strictEqual(result, "a\nb\nc");
  });

  test("count of one", async () => {
    assert.strictEqual(await tailOf("one.txt", "a\nb\nc\n", 1), "c");
  });

  test("count of zero or negative yields empty", async () => {
    assert.strictEqual(await tailOf("zero.txt", "a\nb\n", 0), "");
    assert.strictEqual(await tailOf("negative.txt", "a\nb\n", -3), "");
  });

  test("non-numeric count is rejected", async () => {
    const filePath = rel("bad-count.txt");
    await fileTools.write(filePath, "a\n");
    await assert.rejects(() => fileTools.tail(filePath, "not-a-number"), /tail must be a number/);
  });

  test("file larger than the read window returns complete lines", async () => {
    // Written with fs directly: FileTools.write rejects content over
    // FILE_SIZE_LIMIT and this is a read-path test. The requested lines lie
    // beyond the first 64 KiB window, so the window must actually grow.
    const filePath = path.join(testDir, "large.txt");
    const penultimate = "y".repeat(70 * 1024);
    const content = `first\n${penultimate}\nlast\n`;
    await fs.writeFile(filePath, content, "utf8");

    const result = await fileTools.tail(rel("large.txt"), 2);
    assert.strictEqual(result, `${penultimate}\nlast`);
  });

  test("line longer than one chunk is returned intact", async () => {
    const filePath = path.join(testDir, "longline.txt");
    const line = "w".repeat(90 * 1024);
    await fs.writeFile(filePath, `head\n${line}\n`, "utf8");

    const result = await fileTools.tail(rel("longline.txt"), 1);
    assert.strictEqual(result.length, line.length);
    assert.strictEqual(result, line);
  });

  test("line exceeding the output limit is rejected without buffering the file", async () => {
    const filePath = path.join(testDir, "toolong.txt");
    await fs.writeFile(filePath, `head\n${"z".repeat(200 * 1024)}`, "utf8");
    await assert.rejects(
      () => fileTools.tail(rel("toolong.txt"), 1),
      /Tail result too large/,
    );
  });

  test("large newline-free file is rejected", async () => {
    const filePath = path.join(testDir, "nonewlines.txt");
    await fs.writeFile(filePath, "A".repeat(4 * 1024 * 1024), "utf8");
    await assert.rejects(
      () => fileTools.tail(rel("nonewlines.txt"), 1),
      /Tail result too large/,
    );
  });
});
