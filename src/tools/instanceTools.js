import { execFile } from "child_process";
import { promisify } from "util";
import ConfigManager from "./configManager.js";

/**
 * Provides utilities for managing and launching new system instances.
 */
export default class InstanceTools {
  #execFilePromise = promisify(execFile);
  #config = new ConfigManager();

  /**
   * Launches a new agent instance with the specified message and arguments.
   * @param {object} options - Instance options.
   * @param {string|null} [options.message] - The initial message for the instance.
   * @param {string[]} [options.args] - Additional command-line arguments.
   * @returns {Promise<string>} The result of the instance launch operation.
   * @throws {Error} If the instance launch fails.
   */
  async newAgent({ message = null, args = [] }) {
    const timeout = this.#config.get("instance_timeout", 300);
    const commandArgs = ["--instance-mode"];

    if (message) {
      commandArgs.push("-m", message);
    }

    if (args.length > 0) {
      commandArgs.push(...args);
    }

    const { stdout, stderr } = await this.#execFilePromise("node", ["src_js/main.js", ...commandArgs], {
      timeout: timeout * 1000,
    });

    return `Nueva instancia finalizada.\nSTDOUT:\n${stdout}\nSTDERR:\n${stderr}`;
  }
}
