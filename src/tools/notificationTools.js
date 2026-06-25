import { exec } from "child_process";
import { promisify } from "util";
import path from "path";

/** Notification utility tools. */
export default class NotificationTools {
  #execPromise = promisify(exec);

  /**
   * Notify user with sound and log.
   * @param {string} message Notification message.
   * @returns {Promise<string>} Result.
   */
  async notifyUser(message) {
    try {
      const rootPath = process.cwd();
      const soundPath = path.join(rootPath, "src/assets/type.wav");

      const cmd = `(aplay "${soundPath}" || afplay "${soundPath}" || play "${soundPath}") &`;

      await this.#execPromise(cmd);

      console.log(`[NOTIFICATION]: ${message}`);
      return "OK";
    } catch (e) {
      console.error(`[NOTIFICATION ERROR]: ${e.message}`);
      return "OK";
    }
  }
}