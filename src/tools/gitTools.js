import { execFile } from "child_process";

/**
 * Git operations wrapper providing a clean interface for repository management.
 */
export default class GitTools {
  #cwd;

  #timeoutMs;

  /**
   * Creates a Git wrapper bound to a working directory.
   * @param {object} [options] - Construction options.
   * @param {string} [options.cwd] - Repository directory. Defaults to the
   *   process working directory; tests pass a throwaway repository so they
   *   never mutate the checkout they run in.
   * @param {number} [options.timeoutMs] - Per-command timeout.
   */
  constructor({ cwd = process.cwd(), timeoutMs = 30000 } = {}) {
    this.#cwd = cwd;
    this.#timeoutMs = timeoutMs;
  }

  /**
   * Executes a git command and returns the trimmed output.
   * child_process.execFile has no `input` option, so stdin is written and
   * closed explicitly. Without this, `git apply -` waits forever.
   * @param {string[]} args - Command arguments for the git binary.
   * @param {string} [input] - Optional string to pass to stdin.
   * @returns {Promise<string>} The trimmed standard output of the command.
   * @throws {Error} If the git command fails or times out.
   */
  async #run(args, input) {
    return new Promise((resolve, reject) => {
      const child = execFile(
        "git",
        args,
        { cwd: this.#cwd, timeout: this.#timeoutMs, maxBuffer: 10 * 1024 * 1024 },
        (error, stdout, stderr) => {
          if (error) {
            const detail = stderr && stderr.trim() ? stderr.trim() : error.message;
            reject(new Error(`Git error (${args.join(" ")}): ${detail}`));
            return;
          }
          // Success is defined by the exit code, never by stdout content:
          // `git apply` and `git restore` legitimately print nothing.
          resolve(stdout.trim());
        },
      );

      child.stdin.on("error", (err) => {
        reject(new Error(`Git error (${args.join(" ")}): stdin ${err.message}`));
      });

      if (input !== undefined) {
        child.stdin.end(input);
      } else {
        child.stdin.end();
      }
    });
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
   * Applies a patch directly via stdin to avoid temporary file management.
   * @param {string|{patch: string}} p - Patch content or object containing the patch string.
   * @returns {Promise<string>} The result of the apply command.
   * @throws {Error} If the patch content is missing or the application fails.
   */
  async applyPatch(p) {
    const patch = typeof p === 'object' ? p.patch : p;
    if (!patch) throw new Error("Patch content is required.");

    try {
      return await this.#run(["apply", "--whitespace=nowarn", "-"], patch);
    } catch (e) {
      throw new Error(`Patch application failed: ${e.message}`);
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
   * @param {string|{filepath: string}} f - File path or object containing path.
   * @returns {Promise<string>} The result of the restore command.
   * @throws {Error} If the file path is missing.
   */
  async restoreFile(f) {
    const filepath = typeof f === 'object' ? f.filepath : f;
    if (!filepath) throw new Error("File path is required.");
    return this.#run(["restore", "--", filepath]);
  }
}
