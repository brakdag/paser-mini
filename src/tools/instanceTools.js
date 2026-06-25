import { exec } from "child_process";
import { promisify } from "util";
import ConfigManager from "./configManager.js";

/**
 * Provides utilities for managing and launching new system instances.
 */
export default class InstanceTools {
  #execPromise = promisify(exec);

  #config = new ConfigManager();

  /**
   * Launches a new agent instance with the specified message and arguments.
   * @param {object} options - Instance options.
   * @param {string|null} [options.message] - The initial message for the instance.
   * @param {string[]} [options.args] - Additional command-line arguments.
   * @returns {Promise<string>} The result of the instance launch operation.
   */
  async newAgent({ message = null, args = [] }) {
    try {
      const timeout = this.#config.get("instance_timeout", 300);
      let cmd = "node src_js/main.js --instance-mode";

      if (message) cmd += ` -m "${message}"`;
      if (args.length > 0) cmd += ` ${args.join(" ")}`;

      const { stdout, stderr } = await this.#execPromise(cmd, {
        timeout: timeout * 1000,
      });
      return `Nueva instancia finalizada.\nSTDOUT:\n${stdout}\nSTDERR:\n${stderr}`;
    } catch (e) {
      return `ERR: Error al lanzar la nueva instancia: ${e.message}`;
    }
  }
}

