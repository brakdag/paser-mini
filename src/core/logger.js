import fs from "fs";
import path from "path";

/**
 * Handles application logging, managing both a general system log and a session-specific log.
 */
class Logger {
  /**
   * Initializes the Logger, ensures the log directory exists, and marks the start of a new session.
   * @returns {void}
   */
  constructor() {
    this.logFile = path.join(process.cwd(), "log", "paser_mini.log");
    this.sessionFile = path.join(process.cwd(), "log", "session.log");
    this.agentNickname = null;

    if (!fs.existsSync(path.join(process.cwd(), "log"))) {
      fs.mkdirSync(path.join(process.cwd(), "log"));
    }

    fs.appendFileSync(
      this.logFile,
      `\n--- Session Started: ${new Date().toISOString()} ---\n`,
    );
    fs.appendFileSync(
      this.sessionFile,
      `\n--- Session Started: ${new Date().toISOString()} ---\n`,
    );
  }

  /**
   * Core logging method that writes messages to the appropriate log file based on the level.
   * @param {string} level - The log level (e.g., 'INFO', 'WARN', 'ERROR', 'THOUGHT', 'DEBUG').
   * @param {string} message - The message to be logged.
   * @param {unknown} [data] - Optional additional data to be logged as JSON.
   * @returns {void}
   */
  log(level, message, data = null) {
    const timestamp = new Date().toISOString();
    let targetFile = this.logFile;
    if (level === "THOUGHT") {
      targetFile = this.sessionFile;
    }

    if (level === "THOUGHT") {
      const time = new Date().toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      });
      const nick = this.agentNickname || "agent";
      const logEntry = `[${time}] <${nick}> * thought: ${message}\n`;
      fs.appendFileSync(targetFile, logEntry, "utf8");
      return;
    }

    const logEntry = `[${timestamp}] [${level}] ${message} ${data ? JSON.stringify(data) : ""}\n`;
    fs.appendFileSync(targetFile, logEntry, "utf8");
  }

  /**
   * Sets the nickname of the agent used in session logs.
   * @param {string} nick - The nickname to set.
   * @returns {void}
   */
  setAgentNickname(nick) {
    this.agentNickname = nick;
  }

  /**
   * Logs an informational message.
   * @param {string} msg - The message to log.
   * @param {unknown} [data] - Optional additional data.
   * @returns {void}
   */
  info(msg, data) {
    this.log("INFO", msg, data);
  }

  /**
   * Logs a warning message.
   * @param {string} msg - The message to log.
   * @param {unknown} [data] - Optional additional data.
   * @returns {void}
   */
  warn(msg, data) {
    this.log("WARN", msg, data);
  }

  /**
   * Logs an error message.
   * @param {string} msg - The message to log.
   * @param {unknown} [data] - Optional additional data.
   * @returns {void}
   */
  error(msg, data) {
    this.log("ERROR", msg, data);
  }

  /**
   * Logs a message to the session log as a thought.
   * @param {string} msg - The message to log.
   * @returns {void}
   */
  sessionLog(msg) {
    this.log("THOUGHT", msg);
  }

  /**
   * Logs a debug message.
   * @param {string} msg - The message to log.
   * @param {unknown} [data] - Optional additional data.
   * @returns {void}
   */
  debug(msg, data) {
    this.log("DEBUG", msg, data);
  }
}

const logger = new Logger();

export default logger;