import fs from "fs";
import path from "path";
import logger from "./logger.js";

const LOG_DIR = path.join(process.cwd(), ".paser-mini", "log");

/**
 * Handles logging of session events to a file.
 */
class SessionLogger {
  /**
   * Writes the provided text to the session log file.
   * @param {string} text - The text to be written to the log file.
   * @returns {void}
   */
  writeToLog(text) {
    try {
      if (!fs.existsSync(LOG_DIR)) {
        fs.mkdirSync(LOG_DIR, { recursive: true });
      }
      fs.appendFileSync(path.join(LOG_DIR, "session.log"), `${text}\n`, "utf8");
    } catch (e) {
      logger.error(`[SessionLogger] Log Error: ${e.message}`);
    }
  }
}

export default new SessionLogger();