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

const LEVELS = { off: 0, error: 1, warn: 2, info: 3, debug: 4 };
const MAX_LOG_BYTES = 1024 * 1024;
const MAX_ENTRY_BYTES = 16 * 1024;

/** Manages optional bounded diagnostics and the unchanged session stream. */
class Logger {
  /**
   * Initializes the Logger, ensures the log directory exists, and opens write streams.
   */
  constructor() {
    const logDir = path.join(process.cwd(), ".paser-mini", "log");
    this.logFile = path.join(logDir, "paser_mini.log");
    this.sessionFile = path.join(logDir, "session.log");
    this.agentNickname = null;
    const level = (process.env.PASER_MINI_LOG_LEVEL || "off").toLowerCase();
    this.logLevel = Object.hasOwn(LEVELS, level) ? LEVELS[level] : LEVELS.off;
    this.technicalFailed = false;
    this.closed = false;

    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    // Preserve the session stream and its existing append format.
    this.sessionStream = fs.createWriteStream(this.sessionFile, { flags: "a", encoding: "utf8" });

    // Handle stream errors to prevent uncaught exceptions
    this.sessionStream.on("error", (err) => console.error("Session Stream Error:", err));

    const startMessage = `\n--- Session Started: ${new Date().toISOString()} ---\n`;
    if (this.logLevel) this.writeTechnical(startMessage);
    this.sessionStream.write(startMessage);
  }

  /**
   * Filters diagnostic messages before formatting and writing them.
   * @param {string} level - The log level (e.g., 'INFO', 'WARN', 'ERROR', 'DEBUG').
   * @param {string|(() => string)} message - The message to be logged.
   * @param {unknown} [data] - Optional additional data to be logged as JSON.
   * @returns {void}
   */
  log(level, message, data = null) {
    if (this.closed || this.technicalFailed || !this.logLevel
      || !LEVELS[level.toLowerCase()] || LEVELS[level.toLowerCase()] > this.logLevel) return;
    const timestamp = new Date().toISOString();
    try {
      const resolvedMessage = typeof message === "function" ? message() : message;
      const safeData = data ? JSON.stringify(data, circularReplacer()) : "";
      this.writeTechnical(`[${timestamp}] [${level}] ${resolvedMessage} ${safeData}\n`);
    } catch (err) {
      this.failTechnical(err);
    }
  }

  /**
   * Disables diagnostics after an I/O failure, without affecting session logging.
   * @param {Error} err - The diagnostic failure.
   * @returns {void}
   */
  failTechnical(err) {
    if (!this.technicalFailed) console.error("Technical logging disabled:", err.message);
    this.technicalFailed = true;
  }

  /**
   * Writes bounded diagnostics synchronously, with an exclusive rotation lock.
   * No technical write queue is retained when storage is slow.
   * @param {string} entry - The diagnostic entry.
   * @returns {void}
   */
  writeTechnical(entry) {
    const lockFile = `${this.logFile}.lock`;
    let lock;
    try {
      try {
        lock = fs.openSync(lockFile, "wx");
      } catch (err) {
        if (err.code === "EEXIST") return; // Another instance owns rotation; drop this diagnostic.
        throw err;
      }
      const marker = "… [truncated]\n";
      const buffer = Buffer.from(entry);
      const bounded = buffer.length > MAX_ENTRY_BYTES
        ? Buffer.from(new TextDecoder().decode(buffer.subarray(0, MAX_ENTRY_BYTES - Buffer.byteLength(marker)), { stream: true }) + marker)
        : buffer;
      // Discard oversized legacy archives before rotating the active file.
      [2, 1].forEach((index) => {
        const archive = `${this.logFile}.${index}`;
        if (fs.existsSync(archive) && fs.statSync(archive).size > MAX_LOG_BYTES) fs.unlinkSync(archive);
      });
      const size = fs.existsSync(this.logFile) ? fs.statSync(this.logFile).size : 0;
      if (size > MAX_LOG_BYTES) fs.truncateSync(this.logFile, 0);
      else if (size + bounded.length > MAX_LOG_BYTES) {
        if (fs.existsSync(`${this.logFile}.2`)) fs.unlinkSync(`${this.logFile}.2`);
        if (fs.existsSync(`${this.logFile}.1`)) fs.renameSync(`${this.logFile}.1`, `${this.logFile}.2`);
        fs.renameSync(this.logFile, `${this.logFile}.1`);
      }
      fs.appendFileSync(this.logFile, bounded);
    } catch (err) {
      this.failTechnical(err);
    } finally {
      if (lock !== undefined) {
        try {
          fs.closeSync(lock);
          fs.unlinkSync(lockFile);
        } catch (err) {
          this.failTechnical(err);
        }
      }
    }
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
    this.closed = true;
    this.sessionStream.end();
  }
}

const logger = new Logger();

export default logger;
