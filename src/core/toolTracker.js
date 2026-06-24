class ToolAttemptTracker {
  constructor() {
    this.attempts = new Map();
    this.maxAttempts = 100;
    this.errors = 0;
  }

  /**
   * Records a tool call attempt.
   * @param {string} name
   * @param {any} args
   * @returns {boolean} true if allowed, false if loop detected
   */
  recordAttempt(name, args) {
    const argKey = JSON.stringify(args);
    const key = `${name}:${argKey}`;

    const count = (this.attempts.get(key) || 0) + 1;
    this.attempts.set(key, count);

    return count <= this.maxAttempts;
  }

  /**
   * Clears the attempt counter upon successful execution.
   * @param {string} name
   * @param {any} args
   */
  recordSuccess(name, args) {
    const argKey = JSON.stringify(args);
    this.attempts.delete(`${name}:${argKey}`);
  }

  reset() {
    this.attempts.clear();
  }

  recordFailure() {
    this.errors += 1;
  }
}

export default ToolAttemptTracker;
