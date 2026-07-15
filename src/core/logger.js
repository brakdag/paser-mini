import fs from "fs";
import path from "path";

/**
 * Replacer function for JSON.stringify that detects and replaces circular references.
 * Prevents TypeError: Converting circular structure to JSON.
 * @returns {(key: string, value: unknown) => unknown} A replacer function to be used with JSON.stringify.
 */
const circularReplacer = () => {
  const seen = new WeakSet();
  return (_key, value) => {
    if (typeof value === "object" && value !== null) {
      if (seen.has(value)) return "[Circular]";
      seen.add(value);
    }
    return value;
  };
};

/**
 * Handles application logging, managing both a general system log and a session-specific log.
 */
class Logger {
  /**
   * Initializes the Logger, ensures the log directory exists, and marks the start of a new session.
   * @returns {void}
   */
  constructor() {
    const logDir = path.join(process.cwd(), ".paser-mini", "log");
    this.logFile = path.join(logDir, "paser_mini.log");
    this.sessionFile = path.join(logDir, "session.log");
    this.agentNickname = null;

    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
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
   * Core logging method that writes messages to the system log file.
   * @param {string} level - The log level (e.g., 'INFO', 'WARN', 'ERROR', 'DEBUG').
   * @param {string} message - The message to be logged.
   * @param {unknown} [data] - Optional additional data to be logged as JSON.
   * @returns {void}
   */
  log(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const safeData = data ? JSON.stringify(data, circularReplacer()) : "";
    const logEntry = `[${timestamp}] [${level}] ${message} ${safeData}\n`;
    fs.appendFileSync(this.logFile, logEntry, "utf8");
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
    const time = new Date().toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const nick = this.agentNickname || "agent";
    const logEntry = `[${time}] <${nick}> * thought: ${msg}\n`;
    fs.appendFileSync(this.sessionFile, logEntry, "utf8");
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

