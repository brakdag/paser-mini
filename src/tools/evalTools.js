import fs from 'fs/promises';
import path from 'path';
import vm from 'vm';

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
      const resolvedPath = path.resolve(this.#ROOT_DIR, filename);
      if (!resolvedPath.startsWith(this.#ROOT_DIR)) {
        throw new Error(`SECURITY_ERR: Access denied to ${filename}`);
      }
      await fs.writeFile(resolvedPath, content, 'utf8');
    },
    /**
     * Reads content from a file within the sandbox root.
     * @param {string} filename - The name of the file to read.
     * @returns {Promise<string>} The content of the file.
     */
    read: async (filename) => {
      const resolvedPath = path.resolve(this.#ROOT_DIR, filename);
      if (!resolvedPath.startsWith(this.#ROOT_DIR)) {
        throw new Error(`SECURITY_ERR: Access denied to ${filename}`);
      }
      return await fs.readFile(resolvedPath, 'utf8');
    },
    /**
     * Lists files in the sandbox root directory.
     * @returns {Promise<string[]>} A list of filenames.
     */
    list: async () => await fs.readdir(this.#ROOT_DIR),
    /**
     * Deletes a file within the sandbox root.
     * @param {string} filename - The name of the file to delete.
     * @returns {Promise<void>}
     */
    delete: async (filename) => {
      const resolvedPath = path.resolve(this.#ROOT_DIR, filename);
      if (!resolvedPath.startsWith(this.#ROOT_DIR)) {
        throw new Error(`SECURITY_ERR: Access denied to ${filename}`);
      }
      await fs.unlink(resolvedPath);
    }
  };

  #trace = [];
  #context;

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
        log: (...args) => this.#log('AI_LOG', args),
        error: (...args) => this.#log('AI_ERR', args),
        warn: (...args) => this.#log('AI_WARN', args),
      },
      window: {},
      navigator: { userAgent: 'eval()-V8-Surgical-Sandbox/1.0' },
    };
    return vm.createContext(sandbox);
  }

  /**
   * Internal logger that formats and stores messages in the trace.
   * @param {string} type - The log level/type.
   * @param {unknown[]} args - The data to log.
   */
  #log(type, args) {
    const argsArray = Array.isArray(args) ? args : [args];
    const msg = argsArray.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ');
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    this.#trace.push(`[${timestamp}] [${type}] ${msg}`);
  }

  /**
   * Executes JavaScript code within the VM context.
   * @param {string} code - The JavaScript code to execute.
   * @returns {{trace: string[], result: unknown}}
   * @throws {Error} If the code execution fails catastrophically.
   */
  #execute(code) {
    this.#trace = [];
    let result;
    try {
      // We use runInContext. Note: if the code uses await at top level,
      // it will fail unless wrapped in an async IIFE.
      result = vm.runInContext(code, this.#context, { timeout: 1000 });
      if (result !== undefined) this.#log('RETURN', JSON.stringify(result));
    } catch (err) {
      this.#log('CRASH', err.message);
      throw err; // Propagate the error to the engine
    }
    return { trace: this.#trace, result };
  }

  /**
   * Public interface to execute JavaScript code.
   * @param {object} options - Execution options.
   * @param {string} options.code - The JavaScript code to execute.
   * @returns {string} JSON string containing the result and trace.
   */
  executeJS({ code }) {
    const output = this.#execute(code);
    return JSON.stringify({ result: output.result, trace: output.trace }, null, 2);
  }
}

export default EvalTools;