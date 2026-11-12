import { createHash } from "node:crypto";
import { inspect } from "node:util";
import logger from "./logger.js";

/**
 * Tracks tool calls only when a programmatic repetition limit is explicitly enabled.
 */
class ToolAttemptTracker {
  /**
   * Initializes the tracker with a fresh attempt map.
   */
  constructor() {
    this.attempts = new Map();
    this.maxAttempts = Infinity;
    this.outcomes = new Map();
    this.maxUnchangedResults = Infinity;
  }

  /**
   * Records a tool call attempt and checks if it exceeds the maximum allowed attempts.
   * @param {string} name The name of the tool being called.
   * @param {object} args The arguments passed to the tool.
   * @returns {boolean} True if the attempt is within limits, false if a loop is detected.
   */
  recordAttempt(name, args) {
    if (this.maxAttempts === Infinity && this.maxUnchangedResults === Infinity) return true;
    const key = this._getKey(name, args);
    const count = (this.attempts.get(key) || 0) + 1;
    this.attempts.set(key, count);
    return count <= this.maxAttempts
      && (this.outcomes.get(key)?.unchanged || 0) < this.maxUnchangedResults;
  }

  /**
   * Records unchanged results separately from the total attempt cap. Changed output is progress.
   * @param {string} name The name of the tool.
   * @param {object} args The arguments used in the call.
   * @param {unknown} result The returned tool value.
   */
  recordSuccess(name, args, result) {
    if (this.maxUnchangedResults === Infinity) return;
    const key = this._getKey(name, args);
    const fingerprint = createHash("sha256").update(inspect(result, { depth: null, sorted: true, getters: false, customInspect: false, maxArrayLength: null, maxStringLength: null })).digest("hex");
    const previous = this.outcomes.get(key);
    this.outcomes.set(key, {
      fingerprint,
      unchanged: previous?.fingerprint === fingerprint ? previous.unchanged + 1 : 1,
    });
  }

  /**
   * Resets all recorded attempts.
   */
  reset() {
    this.attempts.clear();
    this.outcomes.clear();
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
    const fingerprint = createHash("sha256").update(inspect(args, { depth: null, sorted: true, getters: false, customInspect: false, maxArrayLength: null, maxStringLength: null })).digest("hex");
    return `${name}:${fingerprint}`;
  }
}

export default ToolAttemptTracker;
