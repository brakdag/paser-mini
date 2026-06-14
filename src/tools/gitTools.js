import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";

export default class GitTools {
  #execFilePromise = promisify(execFile);

  async #run(args) {
    try {
      const { stdout } = await this.#execFilePromise("git", args);
      return stdout.trim();
    } catch (e) {
      throw new Error(`Git error (${args.join(" ")}): ${e.stderr || e.message}`);
    }
  }

  async getCurrentRepo() {
    try {
      const stdout = await this.#run(["remote", "get-url", "origin"]);
      return stdout.replace(/\.git$/, "").split(/[:/]/).slice(-2).join("/");
    } catch { return ""; }
  }

  async gitDiffAll() {
    const stdout = await this.#run(["diff"]);
    return stdout || "No changes found in the repository.";
  }

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

  async getTrackedFiles() {
    const stdout = await this.#run(["ls-files"]);
    return stdout ? stdout.split("\n").filter(Boolean) : [];
  }

  async restoreFile(f) {
    const filepath = typeof f === 'object' ? f.path : f;
    if (!filepath) throw new Error("File path is required.");
    return this.#run(["restore", filepath]);
  }
}