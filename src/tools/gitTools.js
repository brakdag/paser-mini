import { exec } from "child_process";
import { promisify } from "util";

export class GitTools {
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
}
