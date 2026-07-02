/**
 * Tracks tool call attempts to detect and prevent infinite loops.
 */
class ToolAttemptTracker {
  /**
   * Initializes the tracker with a fresh attempt map.
   */
  constructor() {
    this.attempts = new Map();
    this.maxAttempts = 100;
    this.errors = 0;
  }

  /**
   * Records a tool call attempt and checks if it exceeds the maximum allowed attempts.
   * @param {string} name The name of the tool being called.
   * @param {object} args The arguments passed to the tool.
   * @returns {boolean} True if the attempt is within limits, false if a loop is detected.
   */
  recordAttempt(name, args) {
    const argKey = JSON.stringify(args);
    const key = `${name}:${argKey}`;

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
    const argKey = JSON.stringify(args);
    this.attempts.delete(`${name}:${argKey}`);
  }

  /**
   * Resets all recorded attempts.
   */
  reset() {
    this.attempts.clear();
  }

  /**
   * Increments the global error counter.
   */
  recordFailure() {
    this.errors += 1;
  }
}

export default ToolAttemptTracker;