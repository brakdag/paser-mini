import logger from "../../core/logger.js";

const DEFAULT_BACKOFF_MS = 1000;
const RETRYABLE_SERVER_ERRORS = [500, 502, 503, 504];

/**
 * Handles request retries with exponential backoff for Nvidia API.
 */
class NvidiaRetryHandler {
  /**
   * @template ReturnT
   * @param {number} maxRetries - Maximum number of retry attempts before failing.
   * @param {(msg: string) => void} [callback] - Optional callback for retry notifications.
   * @param {object|null} [rateLimiter] - Optional rate limiter with applyRateLimit(tokens) method.
   */
  constructor(maxRetries = 5000, callback = undefined, rateLimiter = null) {
    this.maxRetries = maxRetries;
    this.callback = callback;
    this.rateLimiter = rateLimiter;
  }

  /**
   * Sets the notification callback.
   * @param {(msg: string) => void} callback - The callback function to invoke on retry.
   */
  setCallback(callback) {
    this.callback = callback;
  }

  /**
   * Executes a function with retry logic.
   * @template ReturnT
   * @param {( ...args: unknown[] ) => Promise<ReturnT>} func - The asynchronous function to execute.
   * @param {...unknown} args - Arguments to be passed to the function.
   * @returns {Promise<ReturnT>} The result of the function execution.
   */
  async execute(func, ...args) {
    return this._runRetryLoop(func, args, 0);
  }

  /**
   * Internal recursive loop for handling retries.
   * @template ReturnT
   * @param {( ...args: unknown[] ) => Promise<ReturnT>} func - The function to execute.
   * @param {unknown[]} args - The arguments for the function.
   * @param {number} retries - The current retry attempt count.
   * @returns {Promise<ReturnT>} The result of the function execution.
   */
  async _runRetryLoop(func, args, retries) {
    try {
      return await func(...args);
    } catch (e) {
      const status = e.response?.status;
      if (retries >= this.maxRetries) throw e;

      const { delay, msg } = this._calculateRetryStrategy(e, status, retries);

      if (delay === null) throw e;

      logger.warn(msg);
      if (this.callback) this.callback(msg);

      await new Promise((resolve) => {
        setTimeout(resolve, delay);
      });

      if (this.rateLimiter && typeof this.rateLimiter.applyRateLimit === 'function') {
        await this.rateLimiter.applyRateLimit();
      }

      return this._runRetryLoop(func, args, retries + 1);
    }
  }

  /**
   * Determines the delay and message based on the error status.
   * @param {Error} error - The error object encountered.
   * @param {number|undefined} status - The HTTP status code of the error.
   * @param {number} retries - The current retry attempt count.
   * @returns {{delay: number|null, msg: string}} The calculated delay and notification message.
   */
  _calculateRetryStrategy(error, status, retries) {
    let delay = (2 ** retries) * DEFAULT_BACKOFF_MS;
    let msg = `Unexpected error ${error.message}. Retrying in ${delay / 1000}s...`;

    if (status === 429) {
      const retryAfter = error.response?.headers["retry-after"];
      if (retryAfter && !Number.isNaN(Number(retryAfter))) {
        delay = parseInt(retryAfter, 10) * 1000;
      }
      msg = `Rate limited (429). Retrying in ${delay / 1000}s...`;
    } else if (RETRYABLE_SERVER_ERRORS.includes(status)) {
      msg = `Server error (${status}). Retrying in ${delay / 1000}s...`;
    } else if (status === 404) {
      logger.error("Model not found (404). Stopping execution.");
      return { delay: null, msg: "Model not found" };
    }

    return { delay, msg };
  }
}

export default NvidiaRetryHandler;