import fs from "fs";

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
      fs.appendFileSync("log/session.log", `${text}\n`, "utf8");
    } catch (e) {
      console.error(`[Log Error] ${e.message}`);
    }
  }
}

export default new SessionLogger();