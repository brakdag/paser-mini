import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";

/**
 * Git operations wrapper providing a clean interface for repository management.
 */
export default class GitTools {
  #execFilePromise = promisify(execFile);

  /**
   * Executes a git command and returns the trimmed output.
   * @param {string[]} args - Command arguments for the git binary.
   * @returns {Promise<string>} The trimmed standard output of the command.
   * @throws {Error} If the git command fails.
   */
  async #run(args) {
    try {
      const { stdout } = await this.#execFilePromise("git", args);
      return stdout.trim();
    } catch (e) {
      throw new Error(`Git error (${args.join(" ")}): ${e.stderr || e.message}`);
    }
  }

  /**
   * Gets the current repository identifier from the origin URL.
   * @returns {Promise<string|null>} The repository name or null if not found.
   * @throws {Error} If an unexpected error occurs during the retrieval.
   */
  async getCurrentRepo() {
    try {
      const stdout = await this.#run(["remote", "get-url", "origin"]);
      return stdout.replace(/\.git$/, "").split(/[:/]/).slice(-2).join("/");
    } catch (e) {
      if (e.message.includes("No such remote") || e.message.includes("not a git repository")) {
        return null;
      }
      throw e;
    }
  }

  /**
   * Gets all changes in the repository compared to the index.
   * @returns {Promise<string>} The diff output or a message indicating no changes.
   */
  async gitDiffAll() {
    const stdout = await this.#run(["diff"]);
    return stdout || "No changes found in the repository.";
  }

  /**
   * Applies a patch file to the repository.
   * @param {string|{patch: string}} p - Patch content or object containing the patch string.
   * @returns {Promise<string>} The result of the apply command.
   * @throws {Error} If the patch content is missing or the application fails.
   */
  async applyPatch(p) {
    const patch = typeof p === 'object' ? p.patch : p;
    if (!patch) {
      throw new Error("Patch content is required.");
    }

    const tempFileName = `git_patch_${Date.now()}.patch`;
    const tempFilePath = path.join(process.cwd(), tempFileName);

    try {
      await fs.writeFile(tempFilePath, patch, "utf8");
      await fs.access(tempFilePath);
      return this.#run(["apply", tempFilePath]);
    } catch (e) {
      throw new Error(`Patch application failed: ${e.message}`);
    } finally {
      await fs.unlink(tempFilePath).catch(() => {});
    }
  }

  /**
   * Lists all files currently tracked by git.
   * @returns {Promise<string[]>} An array of file paths.
   */
  async getTrackedFiles() {
    const stdout = await this.#run(["ls-files"]);
    return stdout ? stdout.split("\n").filter(Boolean) : [];
  }

  /**
   * Restores a specific file to its last committed state.
   * @param {string|{path: string}} f - File path or object containing path.
   * @returns {Promise<string>} The result of the restore command.
   * @throws {Error} If the file path is missing.
   */
  async restoreFile(f) {
    const filepath = typeof f === 'object' ? f.path : f;
    if (!filepath) throw new Error("File path is required.");
    return this.#run(["restore", filepath]);
  }
}
