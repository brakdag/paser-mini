import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";

export default class GitTools {
  #execPromise = promisify(exec);

  async getCurrentRepo() {
    try {
      const { stdout } = await this.#execPromise("git remote get-url origin");
      const url = stdout.trim();
      const match = url.match(/[:/]([^/]+(?:\/[^/]+)?)(?:\.git)?$/);
      return match ? match[1] : "";
    } catch (e) {
      return "";
    }
  }

  async gitDiffAll() {
    try {
      const { stdout } = await this.#execPromise("git diff");
      return stdout || "No changes found in the repository.";
    } catch (e) {
      return `ERR: Git diff all error: ${e.message}`;
    }
  }

  async applyPatch({ patch }) {
    if (!patch) {
      throw new Error("Patch content is required.");
    }
    const tempFileName = `.temp_${Date.now()}_patch.patch`;
    const tempFilePath = path.join(process.cwd(), tempFileName);
    try {
      await fs.writeFile(tempFilePath, patch, "utf8");
      const { stdout, stderr } = await this.#execPromise(`git apply ${tempFileName}`);
      return stdout || stderr || "Patch applied successfully.";
    } catch (e) {
      throw new Error(`Failed to apply patch: ${e.stderr || e.message}`);
    } finally {
      try {
        await fs.unlink(tempFilePath);
      } catch (unlinkError) {
        // ignore
      }
    }
  }
}
