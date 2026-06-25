import fs from 'fs';
import path from 'path';
import vm from 'vm';

/**
 * Provides a secure sandbox for executing raw JavaScript code.
 */
class EvalTools {
  #ROOT_DIR = process.cwd();

  #BrowserFS = {
    /**
     * Writes content to a file within the sandbox root.
     * @param {string} filename - The name of the file to write.
     * @param {string} content - The content to write to the file.
     * @returns {{status: string, file: string}} The result of the write operation.
     */
    write: (filename, content) => {
      const resolvedPath = path.resolve(this.#ROOT_DIR, filename);
      if (!resolvedPath.startsWith(this.#ROOT_DIR)) {
        throw new Error(`SECURITY_ERR: Access denied to ${filename}`);
      }
      fs.writeFileSync(resolvedPath, content, 'utf8');
      return { status: 'OK', file: filename };
    },
    /**
     * Reads content from a file within the sandbox root.
     * @param {string} filename - The name of the file to read.
     * @returns {string} The content of the file.
     */
    read: (filename) => {
      const resolvedPath = path.resolve(this.#ROOT_DIR, filename);
      if (!resolvedPath.startsWith(this.#ROOT_DIR)) {
        throw new Error(`SECURITY_ERR: Access denied to ${filename}`);
      }
      return fs.readFileSync(resolvedPath, 'utf8');
    },
    /**
     * Lists files in the sandbox root directory.
     * @returns {string[]} A list of filenames.
     */
    list: () => fs.readdirSync(this.#ROOT_DIR),
    /**
     * Deletes a file within the sandbox root.
     * @param {string} filename - The name of the file to delete.
     * @returns {{status: string, deleted: string}} The result of the deletion.
     */
    delete: (filename) => {
      const resolvedPath = path.resolve(this.#ROOT_DIR, filename);
      if (!resolvedPath.startsWith(this.#ROOT_DIR)) {
        throw new Error(`SECURITY_ERR: Access denied to ${filename}`);
      }
      fs.unlinkSync(resolvedPath);
      return { status: 'OK', deleted: filename };
    }
  };

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
         * Logs a message to the internal trace.
         * @param {...unknown} args - The arguments to log.
         * @returns {void}
         */
        log: (...args) => this.#log('AI_LOG', args),
        /**
         * Logs an error to the internal trace.
         * @param {...unknown} args - The arguments to log.
         * @returns {void}
         */
        error: (...args) => this.#log('AI_ERR', args),
        /**
         * Logs a warning to the internal trace.
         * @param {...unknown} args - The arguments to log.
         * @returns {void}
         */
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
   * @param {unknown} args - The data to log.
   * @returns {void}
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
   * @returns {{trace: string[], result: unknown}} The execution trace and result.
   */
  #execute(code) {
    this.#trace = [];
    let result;
    try {
      result = vm.runInContext(code, this.#context, { timeout: 1000 });
      if (result !== undefined) this.#log('RETURN', JSON.stringify(result));
    } catch (err) {
      this.#log('CRASH', err.message);
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