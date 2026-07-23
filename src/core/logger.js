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
 * Handles application logging using high-performance streams.
 * Manages both a general system log and a session-specific log.
 */
class Logger {
  /**
   * Initializes the Logger, ensures the log directory exists, and opens write streams.
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

    // Use append mode (flags: 'a') for efficient, non-blocking writes
    this.logStream = fs.createWriteStream(this.logFile, { flags: "a", encoding: "utf8" });
    this.sessionStream = fs.createWriteStream(this.sessionFile, { flags: "a", encoding: "utf8" });

    // Handle stream errors to prevent uncaught exceptions
    this.logStream.on("error", (err) => console.error("Log Stream Error:", err));
    this.sessionStream.on("error", (err) => console.error("Session Stream Error:", err));

    const startMessage = `\n--- Session Started: ${new Date().toISOString()} ---\n`;
    this.logStream.write(startMessage);
    this.sessionStream.write(startMessage);
  }

  /**
   * Core logging method that writes messages to the system log file asynchronously.
   * @param {string} level - The log level (e.g., 'INFO', 'WARN', 'ERROR', 'DEBUG').
   * @param {string} message - The message to be logged.
   * @param {unknown} [data] - Optional additional data to be logged as JSON.
   * @returns {void}
   */
  log(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const safeData = data ? JSON.stringify(data, circularReplacer()) : "";
    const logEntry = `[${timestamp}] [${level}] ${message} ${safeData}\n`;
    this.logStream.write(logEntry);
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
   * Logs a debug message.
   * @param {string} msg - The message to log.
   * @param {unknown} [data] - Optional additional data.
   * @returns {void}
   */
  debug(msg, data) {
    this.log("DEBUG", msg, data);
  }

  /**
   * Writes a formatted message to the session log as a thought.
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
    this.sessionStream.write(logEntry);
  }

  /**
   * Writes raw text directly to the session log stream.
   * Used by external loggers like SessionLogger to maintain a single I/O point.
   * @param {string} text - The raw text to write.
   * @returns {void}
   */
  writeRawToSession(text) {
    this.sessionStream.write(`${text}\n`);
  }

  /**
   * Gracefully terminates the write streams, ensuring all buffered data is flushed to disk.
   * Must be called during application shutdown to prevent data loss.
   * @returns {void}
   */
  shutdownStreams() {
    this.logStream.end();
    this.sessionStream.end();
  }
}

const logger = new Logger();

export default logger;
