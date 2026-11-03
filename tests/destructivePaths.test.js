import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import FileTools from "../src/tools/fileTools.js";
import PathValidator from "../src/utils/pathValidator.js";

const METADATA = [".git", ".paser-mini", ".codex", ".agents", ".aws"];

/**
 * Creates a fully disposable project, including its protected metadata.
 * @param {import('node:test').TestContext} t - Cleanup owner.
 * @returns {Promise<object>} Project policy, tools, and fixture paths.
 */
async function makeProject(t) {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), "paser-mutations-"));
  t.after(() => fs.rm(base, { recursive: true, force: true }));
  const root = path.join(base, "project");
  const outside = path.join(base, "outside");
  const sibling = `${root}-evil`;
  await Promise.all([root, outside, sibling].map((dir) => fs.mkdir(dir)));
  await fs.mkdir(path.join(outside, "deep"));
  await Promise.all([root, outside, sibling].map((dir) => fs.writeFile(path.join(dir, "sentinel.txt"), "keep")));
  await fs.writeFile(path.join(root, "source.txt"), "source");
  await Promise.all(METADATA.map(async (name) => {
    await fs.mkdir(path.join(root, name));
    await fs.writeFile(path.join(root, name, "sentinel.txt"), "metadata");
  }));
  const policy = new PathValidator({ root });
  return { root, outside, sibling, policy, tools: new FileTools({ pathValidator: policy }) };
}

describe("filesystem containment matrix", () => {
  const operations = [
    { name: "read", run(tools, input) { return tools.read(input); } },
    { name: "write", run(tools, input) { return tools.write(input, "changed"); } },
    { name: "copy source", run(tools, input) { return tools.copy(input, "copy.txt"); } },
    { name: "copy destination", run(tools, input) { return tools.copy("source.txt", input); } },
    { name: "remove", run(tools, input) { return tools.remove(input); } },
    { name: "move source", run(tools, input) { return tools.rename(input, "moved.txt"); } },
    { name: "move destination", run(tools, input) { return tools.rename("source.txt", input); } },
    { name: "mkdir", run(tools, input) { return tools.mkdir(input); } },
  ];

  operations.forEach(({ name, run }) => {
    it(`${name} rejects external, sibling, symlink and nonexistent external targets`, async (t) => {
      const { root, outside, sibling, tools } = await makeProject(t);
      await fs.symlink(outside, path.join(root, "escape"), "dir");
      await fs.symlink(path.join(outside, "sentinel.txt"), path.join(root, "escape-file"));
      await fs.symlink(path.join(outside, "missing.txt"), path.join(root, "dangling-file"));
      await fs.symlink(path.join(outside, "missing"), path.join(root, "dangling-dir"));
      await fs.symlink(path.join(outside, "deep"), path.join(root, "bridge"), "dir");
      const inputs = [
        path.join(outside, "sentinel.txt"),
        "../outside/sentinel.txt",
        path.join(sibling, "sentinel.txt"),
        "escape/sentinel.txt", "escape-file", "dangling-file", "dangling-dir/new.txt",
        "bridge/../sentinel.txt",
      ];
      for (let i = 0; i < inputs.length; i += 1) {
        await assert.rejects(run(tools, inputs[i]), /outside of project root/, inputs[i]);
      }
      assert.equal(await fs.readFile(path.join(outside, "sentinel.txt"), "utf8"), "keep");
      assert.equal(await fs.readFile(path.join(sibling, "sentinel.txt"), "utf8"), "keep");
      assert.equal(await tools.read("source.txt"), "source");
      await assert.rejects(fs.access(path.join(outside, "missing.txt")), { code: "ENOENT" });
      await assert.rejects(fs.access(path.join(outside, "missing")), { code: "ENOENT" });
      await assert.rejects(fs.access(path.join(root, "copy.txt")), { code: "ENOENT" });
      await assert.rejects(fs.access(path.join(root, "moved.txt")), { code: "ENOENT" });
    });
  });

  it("supports new paths and dot-prefixed names through the whole file lifecycle", async (t) => {
    const { root, tools } = await makeProject(t);
    const names = ["..cache", ".github", ".gitkeep", ".gitignore", ".paser-mini-backup"];
    for (let i = 0; i < names.length; i += 1) {
      const directory = `${names[i]}/new/nested`;
      await tools.write(`${directory}/original.txt`, "data");
      await tools.copy(`${directory}/original.txt`, `${directory}/copy.txt`);
      await tools.rename(`${directory}/copy.txt`, `${directory}/moved.txt`);
      assert.equal(await tools.read(`${directory}/moved.txt`), "data");
      await tools.remove(names[i]);
      await assert.rejects(fs.access(path.join(root, names[i])), { code: "ENOENT" });
    }
  });

  it("moves and deletes internal symlinks without changing their targets", async (t) => {
    const { root, tools } = await makeProject(t);
    await fs.symlink("source.txt", path.join(root, "alias"));
    await tools.copy("alias", "copied.txt");
    assert.equal(await tools.read("copied.txt"), "source");
    await tools.rename("alias", "moved-alias");
    assert.ok((await fs.lstat(path.join(root, "moved-alias"))).isSymbolicLink());
    await tools.remove("moved-alias");
    assert.equal(await tools.read("source.txt"), "source");
    await fs.symlink("new.txt", path.join(root, "dangling-inside"));
    await tools.write("dangling-inside", "new");
    assert.equal(await tools.read("new.txt"), "new");
  });

  it("does not create discarded parent segments in metadata or outside the root", async (t) => {
    const { root, tools } = await makeProject(t);
    await tools.write(".git/discarded/../../ordinary.txt", "valid");
    const externalMissing = path.join(path.dirname(root), "discarded");
    await tools.write(`${externalMissing}/../project/second.txt`, "second");
    await tools.mkdir(".git/discarded/../../ordinary-directory");
    await tools.mkdir(`${externalMissing}/../project/second-directory`);
    assert.equal(await tools.read("ordinary.txt"), "valid");
    assert.equal(await tools.read("second.txt"), "second");
    await fs.access(path.join(root, "ordinary-directory"));
    await fs.access(path.join(root, "second-directory"));
    await assert.rejects(fs.access(path.join(root, ".git", "discarded")), { code: "ENOENT" });
    await assert.rejects(fs.access(externalMissing), { code: "ENOENT" });
  });

  it("refuses to mutate an external directory entry whose final symlink points back inside", async (t) => {
    const { root, outside, tools } = await makeProject(t);
    const externalLink = path.join(outside, "back-inside");
    await fs.symlink(path.join(root, "source.txt"), externalLink);
    await fs.symlink(outside, path.join(root, "bridge-outside"), "dir");
    await assert.rejects(tools.remove("bridge-outside/back-inside"), /outside of project root/);
    await assert.rejects(tools.rename("bridge-outside/back-inside", "moved-link"), /outside of project root/);
    await assert.rejects(tools.rename("source.txt", "bridge-outside/back-inside"), /outside of project root/);
    await assert.rejects(tools.write("bridge-outside/back-inside", "changed"), /outside of project root/);
    assert.ok((await fs.lstat(externalLink)).isSymbolicLink());
    assert.equal(await tools.read("source.txt"), "source");
  });
});

describe("root and metadata protection", () => {
  const mutations = [
    { name: "write", run(tools, input) { return tools.write(input, "changed"); } },
    { name: "copy destination", run(tools, input) { return tools.copy("source.txt", input); } },
    { name: "remove", run(tools, input) { return tools.remove(input); } },
    { name: "move source", run(tools, input) { return tools.rename(input, "moved"); } },
    { name: "move destination", run(tools, input) { return tools.rename("source.txt", input); } },
    { name: "replace", run(tools, input) { return tools.replace(input, "metadata", "changed"); } },
    { name: "sed", run(tools, input) { return tools.sed(input, "metadata", "changed"); } },
    { name: "concat", run(tools, input) { return tools.concat(input, "source.txt"); } },
    { name: "mkdir", run(tools, input) { return tools.mkdir(input); } },
  ];

  mutations.forEach(({ name, run }) => {
    it(`${name} refuses each protected subtree and aliases to it`, async (t) => {
      const { root, tools } = await makeProject(t);
      for (let i = 0; i < METADATA.length; i += 1) {
        const metadata = METADATA[i];
        const target = `${metadata}/sentinel.txt`;
        const alias = `alias-${i}`;
        await fs.symlink(target, path.join(root, alias));
        const parentAlias = `parent-alias-${i}`;
        await fs.symlink(metadata, path.join(root, parentAlias), "dir");
        await fs.symlink("../source.txt", path.join(root, metadata, "returning-link"));
        await assert.rejects(run(tools, target), /protected metadata/);
        await assert.rejects(run(tools, alias), /protected metadata/);
        await assert.rejects(run(tools, `${parentAlias}/returning-link`), /protected metadata/);
        assert.equal(await tools.read(target), "metadata");
      }
      assert.equal(await tools.read("source.txt"), "source");
      await assert.rejects(fs.access(path.join(root, "moved")), { code: "ENOENT" });
    });
  });

  it("rejects root removal and movement only in a disposable project", async (t) => {
    const { root, tools } = await makeProject(t);
    await fs.mkdir(path.join(root, "deep"));
    await fs.symlink(root, path.join(root, "root-alias"), "dir");
    await fs.symlink("deep", path.join(root, "bridge"), "dir");
    const aliases = [".", root, "root-alias", "bridge/.."];
    for (let i = 0; i < aliases.length; i += 1) {
      await assert.rejects(tools.remove(aliases[i]), /refusing to remove the project root/);
      await assert.rejects(tools.rename(aliases[i], "moved-root"), /refusing to move the project root/);
      await assert.rejects(tools.rename("source.txt", aliases[i]), /refusing to overwrite the project root/);
    }
    assert.equal(await tools.read("source.txt"), "source");
    assert.equal(await tools.read(".git/sentinel.txt"), "metadata");
  });

  it("protects metadata represented as a file, including worktree .git files", async (t) => {
    const { root, tools } = await makeProject(t);
    await fs.rm(path.join(root, ".git"), { recursive: true });
    await fs.writeFile(path.join(root, ".git"), "gitdir: /external/worktree");
    await assert.rejects(tools.remove(".git"), /protected metadata/);
    await assert.rejects(tools.rename(".git", "moved"), /protected metadata/);
    assert.equal(await tools.read(".git"), "gitdir: /external/worktree");
  });

  it("rejects a parent containing nested metadata before deleting or moving anything", async (t) => {
    const { root, tools } = await makeProject(t);
    await fs.mkdir(path.join(root, "package", "deep", ".git"), { recursive: true });
    await fs.writeFile(path.join(root, "package", "ordinary.txt"), "keep");
    await assert.rejects(tools.remove("package"), /protected metadata/);
    await assert.rejects(tools.remove("absent/../package"), /protected metadata/);
    await assert.rejects(tools.rename("package", "moved-package"), /protected metadata/);
    await fs.mkdir(path.join(root, "incoming"));
    await assert.rejects(tools.rename("incoming", "package"), /protected metadata/);
    assert.equal(await tools.read("package/ordinary.txt"), "keep");
    await fs.access(path.join(root, "package", "deep", ".git"));
    await fs.access(path.join(root, "incoming"));
    await assert.rejects(fs.access(path.join(root, "moved-package")), { code: "ENOENT" });
  });

  it("does not traverse symlink descendants while removing or moving an ordinary parent", async (t) => {
    const { root, outside, tools } = await makeProject(t);
    await fs.mkdir(path.join(root, "ordinary"));
    await fs.symlink(outside, path.join(root, "ordinary", "external-link"), "dir");
    await fs.symlink(path.join(root, ".git"), path.join(root, "ordinary", "internal-link"), "dir");
    await tools.rename("ordinary", "renamed");
    await tools.remove("renamed");
    assert.equal(await fs.readFile(path.join(outside, "sentinel.txt"), "utf8"), "keep");
    assert.equal(await tools.read(".git/sentinel.txt"), "metadata");
  });

  it("fixes policy roots at construction, including symlinked project roots", async (t) => {
    const { root, policy } = await makeProject(t);
    const alias = `${root}-alias`;
    await fs.symlink(root, alias, "dir");
    const aliasPolicy = new PathValidator({ root: alias });
    const aliasTools = new FileTools({ pathValidator: aliasPolicy });
    assert.equal(policy.getRoot(), root);
    assert.equal(await aliasTools.read("source.txt"), "source");
    await assert.rejects(aliasTools.remove(".git"), /protected metadata/);
    await aliasTools.write("ordinary.txt", "valid");
    assert.equal(await fs.readFile(path.join(root, "ordinary.txt"), "utf8"), "valid");
  });
});
