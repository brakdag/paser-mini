import { execFile } from "child_process";

/**
 * Git operations wrapper providing a clean interface for repository management.
 */
export default class GitTools {
  #cwd;

  #timeoutMs;

  #executable;

  #executableArgs;

  /**
   * Creates a Git wrapper bound to a working directory.
   * @param {object} [options] - Construction options.
   * @param {string} [options.cwd] - Repository directory. Defaults to the
   *   process working directory; tests pass a throwaway repository so they
   *   never mutate the checkout they run in.
   * @param {number} [options.timeoutMs] - Per-command timeout.
   * @param {string} [options.executable] - Git executable or test executable.
   * @param {string[]} [options.executableArgs] - Arguments prepended to each
   *   invocation, useful when injecting a deterministic test executable.
   */
  constructor({
    cwd = process.cwd(),
    timeoutMs = 30000,
    executable = "git",
    executableArgs = [],
  } = {}) {
    this.#cwd = cwd;
    this.#timeoutMs = timeoutMs;
    this.#executable = executable;
    this.#executableArgs = executableArgs;
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
      let commandComplete = false;
      let stdinError;
      let stdinErrorTimer;
      let terminatedForStdinError = false;

      const child = execFile(
        this.#executable,
        [...this.#executableArgs, ...args],
        { cwd: this.#cwd, timeout: this.#timeoutMs, maxBuffer: 10 * 1024 * 1024 },
        (error, stdout, stderr) => {
          commandComplete = true;
          clearTimeout(stdinErrorTimer);
          if (error) {
            const detail = stderr && stderr.trim() ? stderr.trim() : error.message;
            const wrappedError = new Error(`Git error (${args.join(" ")}): ${detail}`, {
              cause: error,
            });
            // Node may report a timeout with `killed: true` and `code: null`
            // (the configured timeout sends SIGTERM), so preserve a useful
            // timeout code for callers as well as the original cause.
            wrappedError.code = error.code || (
              error.killed && !terminatedForStdinError ? "ETIMEDOUT" : undefined
            );
            wrappedError.signal = error.signal;
            wrappedError.stdinError = stdinError;
            reject(wrappedError);
            return;
          }
          // Success is defined by the exit code, never by stdout content:
          // `git apply` and `git restore` legitimately print nothing.
          resolve(stdout.trim());
        },
      );

      child.stdin.on("error", (err) => {
        // EPIPE commonly means the command has already exited and its real
        // exit code is about to arrive. Let that callback win; if the child
        // remains alive, stop it promptly instead of waiting for the command
        // timeout. A successful exit still counts as success despite EPIPE.
        stdinError = err;
        stdinErrorTimer = setTimeout(() => {
          if (!commandComplete && child.exitCode === null && child.signalCode === null) {
            terminatedForStdinError = true;
            child.kill();
          }
        }, 50);
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
   * @param {string} [filepath] - Optional path to limit the diff.
   * @returns {Promise<string>} The diff output or a message indicating no changes.
   */
  async gitDiffAll(filepath) {
    const args = filepath === undefined ? ["diff"] : ["diff", "--", filepath];
    const stdout = await this.#run(args);
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
      const wrappedError = new Error(`Patch application failed: ${e.message}`, { cause: e });
      wrappedError.code = e.code;
      wrappedError.signal = e.signal;
      throw wrappedError;
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
