import fs from "fs/promises";
import path from "path";
import vm from "vm";

/**
 * Provides a secure sandbox for executing raw JavaScript code.
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
    if (!resolvedPath.startsWith(this.#ROOT_DIR)) {
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
   * Creates a secure VM context with a limited sandbox.
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
   * @param {string} code - The JavaScript code to execute.
   * @returns {{trace: string[], result: unknown}} The execution result and trace.
   * @throws {Error} If the code execution fails catastrophically.
   */
  #execute(code) {
    this.#trace = [];
    let result;
    try {
      // We use runInContext. Note: if the code uses await at top level,
      // it will fail unless wrapped in an async IIFE.
      result = vm.runInContext(code, this.#context, { timeout: 1000 });
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
   * @returns {string} The JSON string containing the result and trace.
   */
  executeJS(code) {
    const output = this.#execute(code);
    return JSON.stringify(
      { result: output.result, trace: output.trace },
      null,
      2,
    );
  }
}

export default EvalTools;

