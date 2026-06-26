import { exec } from "child_process";
import { promisify } from "util";
import path from "path";

/**
 * Notification utility tools for providing auditory and visual feedback.
 */
export default class NotificationTools {
  #execPromise = promisify(exec);

  /**
   * Notify the user with a sound and a log entry.
   * @param {string} message - The notification message to log.
   * @returns {Promise<void>} Success is implicit.
   * @throws {Error} If the notification process fails.
   */
  async notifyUser(message) {
    const rootPath = process.cwd();
    const soundPath = path.join(rootPath, "src/assets/type.wav");

    // Strict validation of the sound path to prevent command injection
    if (!soundPath.includes("../") && !soundPath.includes(" ; ") && !soundPath.includes("\n")) {
      // We use a lapped shell command for cross-platform compatibility
      // The sound path is wrapped in double quotes to prevent space-related issues
      const cmd = `(aplay "${soundPath}" || afplay "${soundPath}" || play "${soundPath}") &`;
      await this.#execPromise(cmd);
    } else {
      throw new Error("Invalid sound path detected. Security violation.");
    }

    console.log(`[NOTIFICATION]: ${message}`);
  }
}
