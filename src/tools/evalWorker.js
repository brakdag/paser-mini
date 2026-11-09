import fs from "fs/promises";
import vm from "vm";
import { readFileSync } from "node:fs";
import PathValidator from "../utils/pathValidator.js";

/**
 * Evaluates one call inside the operating-system sandbox created by EvalTools.
 * VM scope separation is for convenience; Bubblewrap supplies the boundary.
 */
class EvalTools {
  #paths;

  /**
   * Project-scoped convenience filesystem exposed in the VM context.
   */
  #BrowserFS = {
    /**
     * Writes content to a file within the project root.
     * @param {string} filename - The name of the file to write.
     * @param {string} content - The content to write to the file.
     * @returns {Promise<void>}
     */
    write: async (filename, content) => {
      const resolvedPath = this.#getSafeSandboxPath(filename, true);
      await fs.writeFile(resolvedPath, content, "utf8");
    },
    /**
     * Reads content from a file within the project root.
     * @param {string} filename - The name of the file to read.
     * @returns {Promise<string>} The content of the file.
     */
    read: async (filename) => {
      const resolvedPath = this.#getSafeSandboxPath(filename);
      return fs.readFile(resolvedPath, "utf8");
    },
    /**
     * Lists files in the project root directory.
     * @returns {Promise<string[]>} A list of filenames.
     */
    list: async () => fs.readdir(this.#paths.getRoot()),
    /**
     * Deletes a file within the project root.
     * @param {string} filename - The name of the file to delete.
     * @returns {Promise<void>}
     */
    delete: async (filename) => {
      const resolvedPath = this.#getSafeSandboxPath(filename, true);
      await fs.unlink(resolvedPath);
    },
  };

  /**
   * Applies the project policy to BrowserFS convenience helpers only.
   * Arbitrary JavaScript is constrained separately by the OS mount namespace.
   * @param {string} filename - The filename to validate.
   * @param {boolean} [mutation] - Whether the helper changes the filesystem.
   * @returns {string} The absolute, safe path.
   * @throws {Error} If the path attempts to traverse outside the project root.
   */
  #getSafeSandboxPath(filename, mutation = false) {
    try {
      return mutation ? this.#paths.getSafeMutationPath(filename) : this.#paths.getSafePath(filename);
    } catch (error) {
      throw new Error(`SECURITY_ERR: ${error.message}`, { cause: error });
    }
  }

  #trace = [];

  #context;

  /**
   * Initializes the EvalTools instance and creates the VM context.
   * @param {object} [options] - Tool dependencies.
   * @param {PathValidator|typeof PathValidator} [options.pathValidator] - Project policy.
   */
  constructor({ pathValidator = PathValidator } = {}) {
    this.#paths = pathValidator;
    this.#context = this.#createContext();
  }

  /**
   * Creates the VM context and the small API surface exposed to it.
   * This context is not a security boundary; its whole process is disposable.
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

      // The parent terminates the entire PID namespace at the deadline.
      if (result && typeof result.then === "function") result = await result;

      if (result !== undefined) {
        const safeResult = typeof result === "object" ? this.#safeStringify(result) : result;
        this.#log("RETURN", [safeResult]);
      }
    } catch (err) {
      this.#log("CRASH", [err.message]);
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

// Input is data on stdin, never interpolated into a shell command.
const { code } = JSON.parse(readFileSync(0, "utf8"));
// Keep unresolved top-level promises alive until the parent kills the namespace.
setInterval(() => undefined, 1000);
let response;
try {
  response = { output: await new EvalTools().executeJS(code) };
} catch (error) {
  response = { error: error.message };
}
// Explicit exit also stops unawaited timers on successful calls. Bubblewrap's
// PID namespace reaper then kills descendants, including detached processes.
process.stdout.write(JSON.stringify(response), () => process.exit(0));

