import { exec } from "child_process";
import { promisify } from "util";
import PathValidator from "../utils/pathValidator.js";
import logger from "../core/logger.js";

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
    const soundPath = PathValidator.getSafePath("src/assets/type.wav");
    const cmd = `(aplay "${soundPath}" || afplay "${soundPath}" || play "${soundPath}") &`;
    await this.#execPromise(cmd);
    logger.info(`[NOTIFICATION]: ${message}`);
  }
}
