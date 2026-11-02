import fs from "fs/promises";
import path from "path";
import vm from "vm";

/**
 * Executes JavaScript in a separate V8 context (`node:vm`).
 *
 * SECURITY MODEL, stated plainly:
 * `vm` is an isolation-of-scope facility, NOT a security boundary. Code run
 * here shares the host process's intrinsics, so it can reach the real
 * `process` and the host filesystem with the user's own permissions (for
 * example via a constructor chain from an exposed function). Treat this tool
 * as "run code as the user", exactly like a shell. Use an operating-system
 * sandbox (container, unprivileged user, seccomp) if genuine isolation is
 * required; no amount of global-hiding inside this file provides it.
 *
 * The timeouts below bound how long a call may block, not the lifetime of
 * asynchronous work the analysed code may have started.
 */
class EvalTools {
  #ROOT_DIR = process.cwd();

  /**
   * Virtual File System provided to the sandbox.
   */
  #BrowserFS = {
    /**
     * Writes content to a file within the sandbox root.
     * @param {string} filename - The name of the file to write.
     * @param {string} content - The content to write to the file.
     * @returns {Promise<void>}
     */
    write: async (filename, content) => {
      const resolvedPath = this.#getSafeSandboxPath(filename);
      await fs.writeFile(resolvedPath, content, "utf8");
    },
    /**
     * Reads content from a file within the sandbox root.
     * @param {string} filename - The name of the file to read.
     * @returns {Promise<string>} The content of the file.
     */
    read: async (filename) => {
      const resolvedPath = this.#getSafeSandboxPath(filename);
      return fs.readFile(resolvedPath, "utf8");
    },
    /**
     * Lists files in the sandbox root directory.
     * @returns {Promise<string[]>} A list of filenames.
     */
    list: async () => fs.readdir(this.#ROOT_DIR),
    /**
     * Deletes a file within the sandbox root.
     * @param {string} filename - The name of the file to delete.
     * @returns {Promise<void>}
     */
    delete: async (filename) => {
      const resolvedPath = this.#getSafeSandboxPath(filename);
      await fs.unlink(resolvedPath);
    },
  };

  /**
   * Validates and resolves a filename within the secure sandbox root.
   * @param {string} filename - The filename to validate.
   * @returns {string} The absolute, safe path.
   * @throws {Error} If the path attempts to traverse outside the sandbox root.
   */
  #getSafeSandboxPath(filename) {
    const resolvedPath = path.resolve(this.#ROOT_DIR, filename);
    // path.relative, not startsWith: the latter accepts sibling directories
    // such as "<root>-evil" whose name merely begins with the root path.
    const relative = path.relative(this.#ROOT_DIR, resolvedPath);
    const escapes =
      relative === ".." ||
      relative.startsWith(`..${path.sep}`) ||
      path.isAbsolute(relative);
    if (escapes) {
      throw new Error(`SECURITY_ERR: Access denied to ${filename}`);
    }
    return resolvedPath;
  }

  #trace = [];

  #context;

  /**
   * Initializes the EvalTools instance and creates the VM context.
   */
  constructor() {
    this.#context = this.#createContext();
  }

  /**
   * Creates the VM context and the small API surface exposed to it.
   * This controls convenience and naming only; it is not a security
   * boundary (see the class documentation).
   * @returns {vm.Context} The created VM context.
   */
  #createContext() {
    const sandbox = {
      BrowserFS: this.#BrowserFS,
      console: {
        /**
         * Logs a message to the AI log.
         * @param {...unknown} args - The arguments to log.
         * @returns {void}
         */
        log: (...args) => this.#log("AI_LOG", args),
        /**
         * Logs an error message to the AI log.
         * @param {...unknown} args - The arguments to log.
         * @returns {void}
         */
        error: (...args) => this.#log("AI_ERR", args),
        /**
         * Logs a warning message to the AI log.
         * @param {...unknown} args - The arguments to log.
         * @returns {void}
         */
        warn: (...args) => this.#log("AI_WARN", args),
      },
      window: {},
      navigator: { userAgent: "eval()-V8-Surgical-Sandbox/1.0" },
    };
    return vm.createContext(sandbox);
  }

  /**
   * Awaits a sandbox-produced promise with a hard deadline.
   * @param {Promise<unknown>} promise - The promise returned by sandboxed code.
   * @returns {Promise<unknown>} The settled value.
   * @throws {Error} If the deadline elapses first.
   */
  async #awaitWithDeadline(promise) {
    const ASYNC_TIMEOUT_MS = 5000;
    let timer;
    const deadline = new Promise((_, reject) => {
      timer = setTimeout(() => {
        reject(
          new Error(
            `ASYNC_TIMEOUT: sandboxed code did not settle within ${ASYNC_TIMEOUT_MS}ms. ` +
              "The wait has been abandoned; the underlying work may still be running.",
          ),
        );
      }, ASYNC_TIMEOUT_MS);
      // The timer is deliberately NOT unref'd. Unref'd timers let Node exit
      // before the deadline fires when nothing else keeps the loop alive,
      // which would abandon the caller without settling its promise. The
      // timer stays referenced until the race settles, then is cleared.
    });

    try {
      return await Promise.race([promise, deadline]);
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Safely stringifies an object, handling circular references.
   * @param {unknown} obj - The object to stringify.
   * @returns {string} The JSON string representation.
   */
  #safeStringify(obj) {
    const seen = new WeakSet();
    return JSON.stringify(obj, (key, value) => {
      if (typeof value === "object" && value !== null) {
        if (seen.has(value)) {
          return "[Circular]";
        }
        seen.add(value);
      }
      return value;
    });
  }

  /**
   * Internal logger that formats and stores messages in the trace.
   * @param {string} type - The log level/type.
   * @param {unknown[]} args - The data to log.
   */
  #log(type, args) {
    const argsArray = Array.isArray(args) ? args : [args];
    const msg = argsArray
      .map((a) => (typeof a === "object" ? this.#safeStringify(a) : a))
      .join(" ");
    const timestamp = new Date().toISOString().split("T")[1].split(".")[0];
    this.#trace.push(`[${timestamp}] [${type}] ${msg}`);
  }

  /**
   * Executes JavaScript code within the VM context.
   * Automatically wraps code in an async IIFE if top-level await is detected.
   * @param {string} code - The JavaScript code to execute.
   * @returns {Promise<{trace: string[], result: unknown}>} The execution result and trace.
   * @throws {Error} If the code execution fails catastrophically.
   */
  async #execute(code) {
    this.#trace = [];
    let result;
    try {
      const wrappedCode = code.includes('await') ? `(async () => { ${code} })()` : code;
      result = vm.runInContext(wrappedCode, this.#context, { timeout: 1000 });

      // Duck typing para Promesas a través de límites de VM.
      // vm's timeout covers only synchronous execution, so an awaiting caller
      // would otherwise wait forever on a promise that never settles. The
      // deadline below bounds the *wait*: the sandboxed async work cannot be
      // forcibly cancelled from inside this process, and the error says so
      // rather than implying the code was stopped.
      if (result && typeof result.then === 'function') {
        result = await this.#awaitWithDeadline(result);
      }

      if (result !== undefined) {
        const safeResult = typeof result === "object" ? this.#safeStringify(result) : result;
        this.#log("RETURN", safeResult);
      }
    } catch (err) {
      this.#log("CRASH", err.message);
      throw err; // Propagate the error to the engine
    }
    return { trace: this.#trace, result };
  }

  /**
   * Public interface to execute JavaScript code.
   * @param {string} code - The JavaScript code to execute.
   * @returns {Promise<string>} The JSON string containing the result and trace.
   */
  async executeJS(code) {
    const output = await this.#execute(code);
    return JSON.stringify(
      { result: output.result, trace: output.trace },
      null,
      2,
    );
  }
}

export default EvalTools;

