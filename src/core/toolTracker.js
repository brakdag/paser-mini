import logger from "./logger.js";

const MAX_ATTEMPTS = 100;

/**
 * Tracks tool call attempts to detect and prevent infinite loops.
 */
class ToolAttemptTracker {
  /**
   * Initializes the tracker with a fresh attempt map.
   */
  constructor() {
    this.attempts = new Map();
    this.maxAttempts = MAX_ATTEMPTS;
  }

  /**
   * Records a tool call attempt and checks if it exceeds the maximum allowed attempts.
   * @param {string} name The name of the tool being called.
   * @param {object} args The arguments passed to the tool.
   * @returns {boolean} True if the attempt is within limits, false if a loop is detected.
   */
  recordAttempt(name, args) {
    const key = this._getKey(name, args);
    const count = (this.attempts.get(key) || 0) + 1;
    this.attempts.set(key, count);
    return count <= this.maxAttempts;
  }

  /**
   * Clears the attempt counter for a specific tool call upon successful execution.
   * @param {string} name The name of the tool.
   * @param {object} args The arguments used in the call.
   */
  recordSuccess(name, args) {
    this.attempts.delete(this._getKey(name, args));
  }

  /**
   * Resets all recorded attempts.
   */
  reset() {
    this.attempts.clear();
  }

  /**
   * Logs a failure for a specific tool call.
   * @param {string} name The name of the tool.
   * @param {object} args The arguments used in the call.
   */
  recordFailure(name, args) {
    const key = this._getKey(name, args);
    logger.warn(`Tool execution failed for ${key}`);
  }

  /**
   * Generates a unique key for a tool call based on its name and arguments.
   * @private
   * @param {string} name The name of the tool.
   * @param {object} args The arguments used in the call.
   * @returns {string} The generated key.
   */
  _getKey(name, args) {
    return `${name}:${JSON.stringify(args)}`;
  }
}

export default ToolAttemptTracker;