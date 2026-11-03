import { execFile } from "child_process";
import PathValidator from "../utils/pathValidator.js";
import gitPatchPaths from "../utils/gitPatchPaths.js";

/**
 * Git operations wrapper providing a clean interface for repository management.
 */
export default class GitTools {
  #cwd;

  #timeoutMs;

  #executable;

  #executableArgs;

  #paths;

  /**
   * Creates a Git wrapper bound to a working directory.
   * @param {object} [options] - Construction options.
   * @param {string} [options.cwd] - Repository directory. Defaults to the
   *   stable project root; tests pass a throwaway repository so they
   *   never mutate the checkout they run in.
   * @param {number} [options.timeoutMs] - Per-command timeout.
   * @param {string} [options.executable] - Git executable or test executable.
   * @param {string[]} [options.executableArgs] - Arguments prepended to each
   *   invocation, useful when injecting a deterministic test executable.
   */
  constructor({
    cwd = PathValidator.getRoot(),
    timeoutMs = 30000,
    executable = "git",
    executableArgs = [],
  } = {}) {
    this.#paths = new PathValidator({ root: cwd });
    this.#cwd = this.#paths.getRoot();
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
   * @param {object} [options] - Output handling.
   * @param {boolean} [options.trim] - Whether to trim human-readable output.
   * @returns {Promise<string>} The trimmed standard output of the command.
   * @throws {Error} If the git command fails or times out.
   */
  async #run(args, input, { trim = true } = {}) {
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
          resolve(trim ? stdout.trim() : stdout);
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
    const args = filepath === undefined ? ["diff"] : ["--literal-pathspecs", "diff", "--", this.#paths.getSafePath(filepath)];
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
      // Ask Git for exact destination names, including binary patches and
      // quoted filenames. This is read-only; validate every path before apply.
      const stats = await this.#run(["apply", "--numstat", "-z", "-"], patch, { trim: false });
      let prefix = "";
      try {
        const output = await this.#run(["rev-parse", "--show-prefix"], undefined, { trim: false });
        prefix = output.replace(/\n$/, "");
      } catch (error) {
        // git apply also works outside repositories, where names are relative
        // to cwd directly. Other discovery failures must not be swallowed.
        if (!error.message.includes("not a git repository")) throw error;
      }
      /**
       * Converts repository patch names into paths under the project cwd.
       * @param {string} filename - Path reported by Git or a patch header.
       * @returns {string} Project-relative path.
       */
      const relativePath = (filename) => {
        if (!filename.startsWith(prefix)) throw new Error("Security Error: patch path is outside of project root");
        return filename.slice(prefix.length);
      };
      stats.split("\0").filter(Boolean).forEach((record) => {
        const fields = record.match(/^[^\t]+\t[^\t]+\t([\s\S]*)$/);
        if (!fields) throw new Error("Cannot determine patch destination");
        this.#paths.getSafeMutationPath(relativePath(fields[1]), { recursive: true });
      });
      gitPatchPaths(patch).forEach((source) => {
        if (source.mutation) this.#paths.getSafeMutationPath(relativePath(source.path), { recursive: true });
        else this.#paths.getSafePath(relativePath(source.path));
      });
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
    const safePath = this.#paths.getSafeMutationPath(filepath, { recursive: true });
    return this.#run(["--literal-pathspecs", "restore", "--", safePath]);
  }
}
