import logger from "./logger.js";

/**
 * Handles logging of session events to a file.
 * Delegates I/O operations to the central Logger instance to ensure
 * stream-based efficiency and prevent file access collisions.
 */
class SessionLogger {
  /**
   * Writes the provided text to the session log file via the central logger stream.
   * @param {string} text - The text to be written to the log file.
   * @returns {void}
   */
  writeToLog(text) {
    try {
      // Delegate to the central logger which uses an efficient WriteStream
      logger.writeRawToSession(text);
    } catch (e) {
      // Fallback to standard error if the central logger fails unexpectedly
      console.error(`[SessionLogger] Delegation Error: ${e.message}`);
    }
  }
}

export default new SessionLogger();
