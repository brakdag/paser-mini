import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";

/**
 * Git operations wrapper.
 */
export default class GitTools {
  #execFilePromise = promisify(execFile);

  /**
   * Executes a git command.
   * @param {string[]} args - Command arguments.
   * @returns {Promise<string>} Trimmed stdout.
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
   * Gets the current repository identifier.
   * @returns {Promise<string>} Repo name.
   */
  async getCurrentRepo() {
    try {
      const stdout = await this.#run(["remote", "get-url", "origin"]);
      return stdout.replace(/\.git$/, "").split(/[:/]/).slice(-2).join("/");
    } catch { return ""; }
  }

  /**
   * Gets all changes in the repository.
   * @returns {Promise<string>} Diff output.
   */
  async gitDiffAll() {
    const stdout = await this.#run(["diff"]);
    return stdout || "No changes found in the repository.";
  }

  /**
   * Applies a patch to the repository.
   * @param {string|{patch: string}} p - Patch content or object containing patch.
   * @returns {Promise<string>} Result of the apply command.
   */
  async applyPatch(p) {
    const patch = typeof p === 'object' ? p.patch : p;
    if (!patch) throw new Error("Patch content is required.");
    const tempFileName = `.temp_${Date.now()}_patch.patch`;
    const tempFilePath = path.join(process.cwd(), tempFileName);
    try {
      await fs.writeFile(tempFilePath, patch, "utf8");
      return this.#run(["apply", tempFileName]);
    } catch (e) {
      throw new Error(`Patch application failed: ${e.message}`);
    } finally {
      await fs.unlink(tempFilePath).catch(() => {});
    }
  }

  /**
   * Lists all tracked files.
   * @returns {Promise<string[]>} Array of file paths.
   */
  async getTrackedFiles() {
    const stdout = await this.#run(["ls-files"]);
    return stdout ? stdout.split("\n").filter(Boolean) : [];
  }

  /**
   * Restores a specific file.
   * @param {string|{path: string}} f - File path or object containing path.
   * @returns {Promise<string>} Result of the restore command.
   */
  async restoreFile(f) {
    const filepath = typeof f === 'object' ? f.path : f;
    if (!filepath) throw new Error("File path is required.");
    return this.#run(["restore", filepath]);
  }
}