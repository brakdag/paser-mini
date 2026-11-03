import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { constants } from "node:fs";
import GitTools from "../src/tools/gitTools.js";

const execFileAsync = promisify(execFile);

/**
 * Creates a throwaway repository with tracked ordinary and metadata files.
 * @param {import('node:test').TestContext} t - Cleanup owner.
 * @returns {Promise<object>} Repository, external paths and Git wrapper.
 */
async function fixture(t) {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), "paser-git-policy-"));
  t.after(() => fs.rm(base, { recursive: true, force: true }));
  const root = path.join(base, "project");
  const outside = path.join(base, "outside");
  await fs.mkdir(path.join(root, ".codex"), { recursive: true });
  await fs.mkdir(outside);
  await execFileAsync("git", ["init", "-q"], { cwd: root });
  await fs.writeFile(path.join(root, "source.txt"), "source\n");
  await fs.writeFile(path.join(root, ".codex", "config"), "keep\n");
  await fs.writeFile(path.join(outside, "secret.txt"), "outside\n");
  await execFileAsync("git", ["add", "source.txt", ".codex/config"], { cwd: root });
  await execFileAsync("git", ["-c", "user.name=Test", "-c", "user.email=test@example.invalid", "commit", "-qm", "initial"], { cwd: root });
  return { root, outside, tools: new GitTools({ cwd: root }) };
}

/**
 * Builds a one-line replacement patch using Git's filename quoting.
 * @param {string} filename - Project-relative filename.
 * @param {string} [oldText] - Previous first line.
 * @param {string} [newText] - New first line.
 * @returns {string} Unified patch.
 */
function replacePatch(filename, oldText = "source", newText = "changed") {
  return `diff --git ${JSON.stringify(`a/${filename}`)} ${JSON.stringify(`b/${filename}`)}
--- ${JSON.stringify(`a/${filename}`)}
+++ ${JSON.stringify(`b/${filename}`)}
@@ -1 +1 @@
-${oldText}
+${newText}
`;
}

describe("Git paths obey the project policy", () => {
  it("restore refuses metadata, aliases, traversal and the root", async (t) => {
    const { root, outside, tools } = await fixture(t);
    await fs.writeFile(path.join(root, ".codex", "config"), "modified metadata\n");
    await fs.symlink(".codex", path.join(root, "alias"), "dir");
    await fs.symlink(outside, path.join(root, "escape"), "dir");
    const cases = [
      [".codex/config", /protected metadata/], ["alias/config", /protected metadata/],
      ["../outside/secret.txt", /outside of project root/], ["escape/secret.txt", /outside of project root/],
      [".", /project root/],
    ];
    for (let i = 0; i < cases.length; i += 1) {
      await assert.rejects(tools.restoreFile(cases[i][0]), cases[i][1]);
    }
    assert.equal(await fs.readFile(path.join(root, ".codex", "config"), "utf8"), "modified metadata\n");
    assert.equal(await fs.readFile(path.join(outside, "secret.txt"), "utf8"), "outside\n");
  });

  it("restore and diff treat wildcard and pathspec syntax as literal filenames", async (t) => {
    const { root, tools } = await fixture(t);
    await fs.writeFile(path.join(root, "*.txt"), "literal\n");
    await execFileAsync("git", ["--literal-pathspecs", "add", "--", "*.txt"], { cwd: root });
    await fs.writeFile(path.join(root, "*.txt"), "changed literal\n");
    await fs.writeFile(path.join(root, "source.txt"), "changed source\n");
    const diff = await tools.gitDiffAll("*.txt");
    assert.match(diff, /changed literal/);
    assert.doesNotMatch(diff, /changed source/);
    await tools.restoreFile("*.txt");
    assert.equal(await fs.readFile(path.join(root, "*.txt"), "utf8"), "literal\n");
    assert.equal(await fs.readFile(path.join(root, "source.txt"), "utf8"), "changed source\n");
    await assert.rejects(tools.restoreFile(":(top)*"));
    assert.equal(await fs.readFile(path.join(root, "source.txt"), "utf8"), "changed source\n");
  });

  it("validates the entire patch before applying any file changes", async (t) => {
    const { root, tools } = await fixture(t);
    const patch = replacePatch("source.txt") + replacePatch(".codex/config", "keep");
    await assert.rejects(tools.applyPatch(patch), /protected metadata/);
    assert.equal(await fs.readFile(path.join(root, "source.txt"), "utf8"), "source\n");
    assert.equal(await fs.readFile(path.join(root, ".codex", "config"), "utf8"), "keep\n");
  });

  it("rejects protected rename sources, including octal-quoted names", async (t) => {
    const { root, tools } = await fixture(t);
    const sources = [".codex/config", '"\\056codex/config"'];
    for (let i = 0; i < sources.length; i += 1) {
      const patch = `diff --git a/.codex/config b/moved
similarity index 100%
rename from ${sources[i]}
rename to moved
`;
      await assert.rejects(tools.applyPatch(patch), /protected metadata/);
    }
    // Git permits different old/new names even without a rename header.
    const oldNewPatch = `diff --git a/.codex/config b/moved
--- a/.codex/config
+++ b/moved
@@ -1 +1 @@
-keep
+changed
`;
    await assert.rejects(tools.applyPatch(oldNewPatch), /protected metadata/);
    assert.equal(await fs.readFile(path.join(root, ".codex", "config"), "utf8"), "keep\n");
    await assert.rejects(fs.access(path.join(root, "moved")), { code: "ENOENT" });
  });

  it("rejects an escaping symlink destination and leaves external contents intact", async (t) => {
    const { root, outside, tools } = await fixture(t);
    await fs.symlink(outside, path.join(root, "escape"), "dir");
    await assert.rejects(tools.applyPatch(replacePatch("escape/secret.txt", "outside")), /outside of project root/);
    assert.equal(await fs.readFile(path.join(outside, "secret.txt"), "utf8"), "outside\n");
  });

  it("preserves whitespace and Unicode filenames and ignores header-like hunk contents", async (t) => {
    const { root, tools } = await fixture(t);
    const filename = "café\twith space \n.txt";
    await fs.writeFile(path.join(root, filename), "-- .codex/config\n");
    await tools.applyPatch(replacePatch(filename, "-- .codex/config", "ordinary"));
    assert.equal(await fs.readFile(path.join(root, filename), "utf8"), "ordinary\n");
  });

  it("accepts ordinary renames and mode changes while protecting metadata mode changes", async (t) => {
    const { root, tools } = await fixture(t);
    await tools.applyPatch(`diff --git a/source.txt b/renamed.txt
similarity index 100%
rename from source.txt
rename to renamed.txt
`);
    assert.equal(await fs.readFile(path.join(root, "renamed.txt"), "utf8"), "source\n");
    await tools.applyPatch(`diff --git a/renamed.txt b/renamed.txt
old mode 100644
new mode 100755
`);
    await fs.access(path.join(root, "renamed.txt"), constants.X_OK);
    await assert.rejects(tools.applyPatch(`diff --git a/.codex/config b/.codex/config
old mode 100644
new mode 100755
`), /protected metadata/);
  });

  it("maps repository patch paths to a project started in a subdirectory", async (t) => {
    const { root } = await fixture(t);
    const directory = path.join(root, " subdir");
    await fs.mkdir(directory);
    await fs.writeFile(path.join(directory, "source.txt"), "source\n");
    const tools = new GitTools({ cwd: directory });
    await tools.applyPatch(replacePatch(" subdir/source.txt"));
    assert.equal(await fs.readFile(path.join(directory, "source.txt"), "utf8"), "changed\n");
    await assert.rejects(tools.applyPatch(replacePatch("source.txt")), /outside of project root/);
    assert.equal(await fs.readFile(path.join(root, "source.txt"), "utf8"), "source\n");
  });

  it("applies a binary patch without changing its bytes", async (t) => {
    const { root, tools } = await fixture(t);
    const filename = path.join(root, "binary.bin");
    const before = Buffer.from([0, 1, 2, 3, 0, 255]);
    const after = Buffer.from([0, 4, 5, 6, 0, 254]);
    await fs.writeFile(filename, before);
    await execFileAsync("git", ["add", "binary.bin"], { cwd: root });
    await fs.writeFile(filename, after);
    const { stdout: patch } = await execFileAsync("git", ["diff", "--binary", "--", "binary.bin"], { cwd: root });
    assert.match(patch, /GIT binary patch/);
    await fs.writeFile(filename, before);
    await tools.applyPatch(patch);
    assert.deepEqual(await fs.readFile(filename), after);
  });

  it("supports applying ordinary patches outside a Git repository", async (t) => {
    const { outside } = await fixture(t);
    const tools = new GitTools({ cwd: outside });
    await tools.applyPatch(replacePatch("secret.txt", "outside", "updated"));
    assert.equal(await fs.readFile(path.join(outside, "secret.txt"), "utf8"), "updated\n");
  });

  it("keeps the default Git project fixed when instantiated after chdir", async (t) => {
    const { root, outside } = await fixture(t);
    const moduleUrl = new URL("../src/tools/gitTools.js", import.meta.url).href;
    const script = `
      import assert from "node:assert/strict";
      import { writeSync } from "node:fs";
      import GitTools from ${JSON.stringify(moduleUrl)};
      process.chdir(${JSON.stringify(outside)});
      assert.deepEqual(await new GitTools().getTrackedFiles(), [".codex/config", "source.txt"]);
      writeSync(1, "stable-git-root\\n");
    `;
    const { stdout } = await execFileAsync(process.execPath, ["--input-type=module", "-e", script], { cwd: root, timeout: 5000 });
    assert.equal(stdout.trim(), "stable-git-root");
  });
});
