import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import PathValidator from "../src/utils/pathValidator.js";
import FileTools from "../src/tools/fileTools.js";

const fileTools = new FileTools();

describe("pathValidator", () => {
  let fixtureDir;
  let externalDir;

  before(async () => {
    // Unique fixture inside the project root: the validator bounds every
    // operation to the root, and a unique name keeps parallel runs isolated.
    fixtureDir = await fs.mkdtemp(path.join(process.cwd(), "tests", "tmp-path-"));
    externalDir = await fs.mkdtemp(path.join(os.tmpdir(), "paser-external-"));
    await fs.mkdir(path.join(externalDir, "deep"));
    await fs.writeFile(path.join(externalDir, "secret.txt"), "secret", "utf8");
  });

  after(async () => {
    await fs.rm(fixtureDir, { recursive: true, force: true });
    await fs.rm(externalDir, { recursive: true, force: true });
  });

  /**
   * Maps a fixture name to a path relative to the project root.
   * @param {string} name - File name inside the fixture directory.
   * @returns {string} Path relative to the working directory.
   */
  const rel = (name) => path.relative(process.cwd(), path.join(fixtureDir, name));

  it("accepts names that begin with dots", async () => {
    const target = path.join(fixtureDir, "..cache");
    await fs.mkdir(target, { recursive: true });
    assert.strictEqual(
      PathValidator.getSafePath(rel("..cache")),
      path.resolve(target),
    );
  });

  it("accepts and writes a new nested path inside the root", async () => {
    const target = rel("new/nested/file.txt");
    assert.strictEqual(PathValidator.getSafePath(target), path.resolve(target));
    await fileTools.write(target, "inside");
    assert.strictEqual(await fileTools.read(target), "inside");
  });

  it("rejects lexical traversal", () => {
    assert.throws(() => PathValidator.getSafePath("../outside.txt"), /outside of project root/);
  });

  it("rejects a sibling directory sharing the root name prefix", () => {
    const sibling = path.resolve(`${process.cwd()}-evil`, "file.txt");
    assert.throws(() => PathValidator.getSafePath(sibling), /outside of project root/);
  });

  it("rejects an absolute path outside the root", () => {
    assert.throws(() => PathValidator.getSafePath("/etc/passwd"), /outside of project root/);
  });

  it("rejects a symlink that escapes the root", async () => {
    const linkPath = path.join(fixtureDir, "escape-link");
    await fs.symlink(externalDir, linkPath, "dir");

    assert.throws(
      () => PathValidator.getSafePath(rel("escape-link/secret.txt")),
      /resolves outside of project root/,
    );
    await assert.rejects(
      () => fileTools.read(rel("escape-link/secret.txt")),
      /resolves outside of project root/,
    );
  });

  it("rejects a dangling symlink targeting a nonexistent external file", async () => {
    const target = path.join(externalDir, "created-through-link.txt");
    const linkPath = path.join(fixtureDir, "dangling-file");
    await fs.symlink(target, linkPath, "file");

    assert.throws(
      () => PathValidator.getSafePath(rel("dangling-file")),
      /resolves outside of project root/,
    );
    await assert.rejects(
      () => fileTools.write(rel("dangling-file"), "escaped"),
      /resolves outside of project root/,
    );
    await assert.rejects(() => fs.access(target), /ENOENT/);
  });

  it("rejects a path created through a dangling symlink to an external directory", async () => {
    const externalMissing = path.join(externalDir, "not-yet-created");
    const linkPath = path.join(fixtureDir, "dangling-dir");
    await fs.symlink(externalMissing, linkPath, "dir");

    await assert.rejects(
      () => fileTools.write(rel("dangling-dir/new-file.txt"), "escaped"),
      /resolves outside of project root/,
    );
    await assert.rejects(() => fs.access(externalMissing), /ENOENT/);
  });

  it("rejects a dangling symlink whose target escapes through a relative hop", async () => {
    const linkPath = path.join(fixtureDir, "relative-escape");
    await fs.symlink("../../../../etc/passwd", linkPath, "file");
    assert.throws(
      () => PathValidator.getSafePath(rel("relative-escape")),
      /resolves outside of project root/,
    );
  });

  it("rejects a compound link whose intermediate symlink redirects '..'", async () => {
    // "bridge" is a symlink to an external directory, and the link target is
    // "bridge/../outside.txt". Lexically that collapses to an internal file,
    // but the kernel resolves "bridge" first, so ".." means the external
    // directory's parent. Resolving ".." textually would accept an escape.
    const bridge = path.join(fixtureDir, "bridge");
    await fs.symlink(path.join(externalDir, "deep"), bridge, "dir");
    const compound = path.join(fixtureDir, "compound-link");
    await fs.symlink("bridge/../outside.txt", compound, "file");

    assert.throws(
      () => PathValidator.getSafePath(rel("compound-link")),
      /resolves outside of project root/,
    );
    await assert.rejects(
      () => fileTools.write(rel("compound-link"), "escaped"),
      /resolves outside of project root/,
    );
    const sentinel = await fs.access(path.join(externalDir, "outside.txt")).then(
      () => true,
      () => false,
    );
    assert.strictEqual(sentinel, false, "external sentinel must not be created");
  });

  it("rejects a compound link with an absolute target containing '..'", async () => {
    const bridge = path.join(fixtureDir, "abs-bridge");
    await fs.symlink(path.join(externalDir, "deep"), bridge, "dir");
    const compound = path.join(fixtureDir, "abs-compound");
    const target = `${bridge}${path.sep}..${path.sep}abs-outside.txt`;
    await fs.symlink(target, compound, "file");
    assert.strictEqual(await fs.readlink(compound), target);

    assert.throws(
      () => PathValidator.getSafePath(rel("abs-compound")),
      /resolves outside of project root/,
    );
    await assert.rejects(
      () => fileTools.write(rel("abs-compound"), "escaped"),
      /resolves outside of project root/,
    );
    await assert.rejects(() => fs.access(path.join(externalDir, "abs-outside.txt")), /ENOENT/);
  });

  it("rejects a compound link chained through two internal links", async () => {
    const bridge = path.join(fixtureDir, "chain-bridge");
    await fs.symlink(externalDir, bridge, "dir");
    const hop = path.join(fixtureDir, "chain-hop");
    await fs.symlink("chain-bridge", hop, "dir");
    const compound = path.join(fixtureDir, "chain-compound");
    await fs.symlink("chain-hop/../chain-outside.txt", compound, "file");

    assert.throws(
      () => PathValidator.getSafePath(rel("chain-compound")),
      /resolves outside of project root/,
    );
  });

  it("rejects a symlink loop instead of recursing forever", async () => {
    const a = path.join(fixtureDir, "loop-a");
    const b = path.join(fixtureDir, "loop-b");
    await fs.symlink(b, a, "file");
    await fs.symlink(a, b, "file");
    assert.throws(
      () => PathValidator.getSafePath(rel("loop-a")),
      /too many levels of symbolic links/,
    );
  });

  it("checks literal '..' after a symlink in both relative and absolute inputs", async () => {
    const bridge = path.join(fixtureDir, "literal-bridge");
    await fs.symlink(path.join(externalDir, "deep"), bridge, "dir");
    const absolute = `${bridge}/../secret.txt`;
    const relative = `${path.relative(process.cwd(), bridge)}/../secret.txt`;

    [relative, absolute].forEach((input) => {
      assert.throws(() => PathValidator.getSafePath(input), /outside of project root/);
    });
    await assert.rejects(() => fileTools.write(absolute, "changed"), /outside of project root/);
    assert.strictEqual(await fs.readFile(path.join(externalDir, "secret.txt"), "utf8"), "secret");
  });

  it("preserves traversal semantics for an internal symlink followed by '..'", async () => {
    const target = path.join(fixtureDir, "internal-parent", "deep");
    await fs.mkdir(target, { recursive: true });
    await fs.writeFile(path.join(fixtureDir, "internal-parent", "value.txt"), "actual");
    await fs.writeFile(path.join(fixtureDir, "value.txt"), "lexical");
    const bridge = path.join(fixtureDir, "internal-bridge");
    await fs.symlink(target, bridge, "dir");

    assert.strictEqual(await fileTools.read(`${bridge}/../value.txt`), "actual");
    await fileTools.write(`${bridge}/../value.txt`, "updated");
    assert.strictEqual(await fs.readFile(path.join(fixtureDir, "internal-parent", "value.txt"), "utf8"), "updated");
    assert.strictEqual(await fs.readFile(path.join(fixtureDir, "value.txt"), "utf8"), "lexical");
  });

  it("rechecks existing links after walking back from a missing component", async () => {
    await fs.symlink(externalDir, path.join(fixtureDir, "missing-escape"), "dir");
    const compound = path.join(fixtureDir, "missing-compound");
    await fs.symlink("absent/../missing-escape/secret.txt", compound, "file");

    assert.throws(() => PathValidator.getSafePath(compound), /outside of project root/);
    await assert.rejects(() => fileTools.write(compound, "changed"), /outside of project root/);
    assert.strictEqual(await fs.readFile(path.join(externalDir, "secret.txt"), "utf8"), "secret");
  });

  it("recognizes the root reached through a symlink and parent segment", async () => {
    const bridge = path.join(fixtureDir, "root-bridge");
    await fs.symlink(path.join(process.cwd(), "tests"), bridge, "dir");
    assert.ok(PathValidator.isRoot(PathValidator.getSafePath(`${bridge}/..`)));
    assert.ok(PathValidator.isRoot("."));
    assert.ok(!PathValidator.isRoot(fixtureDir));
  });

  it("accepts a symlink that stays inside the root", async () => {
    const realDir = path.join(fixtureDir, "real");
    await fs.mkdir(realDir, { recursive: true });
    await fs.writeFile(path.join(realDir, "inside.txt"), "ok", "utf8");
    const linkPath = path.join(fixtureDir, "inner-link");
    await fs.symlink(realDir, linkPath, "dir");

    assert.strictEqual(await fileTools.read(rel("inner-link/inside.txt")), "ok");
  });

  it("accepts a dangling symlink that stays inside the root", async () => {
    const innerTarget = path.join(fixtureDir, "later.txt");
    const linkPath = path.join(fixtureDir, "inner-dangling");
    await fs.symlink(innerTarget, linkPath, "file");

    assert.strictEqual(PathValidator.getSafePath(rel("inner-dangling")), path.resolve(linkPath));
    await fileTools.write(rel("inner-dangling"), "fine");
    assert.strictEqual(await fs.readFile(innerTarget, "utf8"), "fine");
  });

  it("rejects null bytes and empty input", () => {
    assert.throws(() => PathValidator.getSafePath("a\0b"), /null byte/);
    assert.throws(() => PathValidator.getSafePath(""), /non-empty string/);
  });

  it("refuses to remove the project root", async () => {
    await assert.rejects(() => fileTools.remove("."), /refusing to remove the project root/);
    // The disposable checkout must still be here.
    await fs.access(path.resolve(process.cwd()));
  });

  it("refuses to move the project root", async () => {
    await assert.rejects(
      () => fileTools.rename(".", rel("moved")),
      /refusing to move the project root/,
    );
  });

  it("exposes a stable root identity", () => {
    assert.strictEqual(PathValidator.getRoot(), path.resolve(process.cwd()));
    assert.ok(PathValidator.isRoot(process.cwd()));
    assert.ok(!PathValidator.isRoot(fixtureDir));
  });
});
