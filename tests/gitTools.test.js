import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import GitTools from "../src/tools/gitTools.js";

const execFileAsync = promisify(execFile);

/**
 * Runs a git command inside the fixture repository.
 * @param {string} cwd - Repository directory.
 * @param {string[]} args - Git arguments.
 * @returns {Promise<string>} Trimmed stdout.
 */
async function git(cwd, args) {
  const { stdout } = await execFileAsync("git", args, { cwd });
  return stdout.trim();
}

describe("gitTools", () => {
  let repoDir;
  let gitTools;

  before(async () => {
    // A disposable repository: the suite must never touch the real checkout.
    repoDir = await fs.mkdtemp(path.join(os.tmpdir(), "paser-git-"));
    await git(repoDir, ["init", "--initial-branch=main"]);
    await git(repoDir, ["config", "user.email", "test@example.invalid"]);
    await git(repoDir, ["config", "user.name", "Test"]);
    await fs.writeFile(path.join(repoDir, "base.txt"), "base\n", "utf8");
    await fs.writeFile(path.join(repoDir, "other.txt"), "other\n", "utf8");
    await git(repoDir, ["add", "base.txt", "other.txt"]);
    await git(repoDir, ["commit", "-m", "initial"]);
    gitTools = new GitTools({ cwd: repoDir });
  });

  after(async () => {
    await fs.rm(repoDir, { recursive: true, force: true });
  });

  it("should report no changes for a clean tree", async () => {
    const result = await gitTools.gitDiffAll();
    assert.strictEqual(result, "No changes found in the repository.");
  });

  it("should list tracked files", async () => {
    const files = await gitTools.getTrackedFiles();
    assert.deepStrictEqual(files, ["base.txt", "other.txt"]);
  });

  it("should apply a patch delivered through stdin", async () => {
    const patchContent = `diff --git a/created.txt b/created.txt
new file mode 100644
index 0000000..f7db191
--- /dev/null
+++ b/created.txt
@@ -0,0 +1 @@
+Patch applied successfully!
`;

    // Success must not depend on stdout: `git apply` prints nothing.
    const result = await gitTools.applyPatch({ patch: patchContent });
    assert.strictEqual(result, "");

    const fileContent = await fs.readFile(path.join(repoDir, "created.txt"), "utf8");
    assert.strictEqual(fileContent, "Patch applied successfully!\n");
  });

  it("should reject an invalid patch", async () => {
    await assert.rejects(
      () => gitTools.applyPatch({ patch: "not a patch at all" }),
      /Patch application failed/,
    );
  });

  it("should refuse a missing patch", async () => {
    await assert.rejects(() => gitTools.applyPatch({}), /Patch content is required/);
  });

  it("should restore a modified file", async () => {
    const target = path.join(repoDir, "base.txt");
    await fs.writeFile(target, "corrupted\n", "utf8");
    await gitTools.restoreFile({ filepath: "base.txt" });
    assert.strictEqual(await fs.readFile(target, "utf8"), "base\n");
  });

  it("accepts canonical restore objects and rejects conflicting paths without changing files", async () => {
    const target = path.join(repoDir, "base.txt");
    await fs.writeFile(target, "changed\n");
    await assert.rejects(gitTools.restoreFile({ path: "base.txt", filepath: "other.txt" }), /Conflicting arguments/);
    assert.strictEqual(await fs.readFile(target, "utf8"), "changed\n");
    await gitTools.restoreFile({ path: "base.txt" });
    assert.strictEqual(await fs.readFile(target, "utf8"), "base\n");
  });

  it("should limit a diff to the requested path", async () => {
    await fs.writeFile(path.join(repoDir, "base.txt"), "changed base\n", "utf8");
    await fs.writeFile(path.join(repoDir, "other.txt"), "changed other\n", "utf8");

    const result = await gitTools.gitDiffAll("base.txt");

    assert.match(result, /diff --git a\/base\.txt b\/base\.txt/);
    assert.doesNotMatch(result, /other\.txt/);

    await git(repoDir, ["restore", "--", "base.txt", "other.txt"]);
  });

  it("should terminate an unresponsive executable when the timeout expires", async () => {
    const scriptPath = path.join(repoDir, "unresponsive-process.mjs");
    await fs.writeFile(
      scriptPath,
      "process.stdin.resume();\nsetInterval(() => {}, 1000);\n",
      "utf8",
    );
    const timeoutTools = new GitTools({
      cwd: repoDir,
      timeoutMs: 100,
      executable: process.execPath,
      executableArgs: [scriptPath],
    });

    await assert.rejects(
      () => timeoutTools.applyPatch("ignored patch data"),
      (error) => {
        assert.strictEqual(error.code, "ETIMEDOUT");
        assert.strictEqual(error.cause.code, "ETIMEDOUT");
        assert.ok(error.cause.cause);
        return true;
      },
    );

    await fs.rm(scriptPath, { force: true });
  });

  it("should preserve the command exit code when stdin closes early", async () => {
    const scriptPath = path.join(repoDir, "fail-before-reading.mjs");
    await fs.writeFile(scriptPath, "process.exit(7);\n", "utf8");
    const failingTools = new GitTools({
      cwd: repoDir,
      timeoutMs: 1000,
      executable: process.execPath,
      executableArgs: [scriptPath],
    });

    await assert.rejects(
      () => failingTools.applyPatch("x".repeat(2 * 1024 * 1024)),
      (error) => {
        assert.strictEqual(error.code, 7);
        assert.strictEqual(error.cause.code, 7);
        assert.strictEqual(error.cause.stdinError.code, "EPIPE");
        assert.ok(error.cause.cause);
        return true;
      },
    );

    await fs.rm(scriptPath, { force: true });
  });
});
