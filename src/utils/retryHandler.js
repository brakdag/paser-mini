import { setTimeout as delay } from "node:timers/promises";

/**
 * Handles exponential backoff retries with a maximum cap.
 */
class RetryHandler {
  /**
   * Creates an instance of RetryHandler.
   * @param {number} maxRetries - Maximum number of retry attempts.
   * @param {number} maxDelay - Maximum delay between retries in milliseconds (default: 5 minutes).
   */
  constructor(maxRetries = 15, maxDelay = 300000) {
    this.maxRetries = maxRetries;
    this.maxDelay = maxDelay;
  }

  /**
   * Formats milliseconds into a human-readable string (e.g., "2.5h", "45m").
   * @param {number} ms - Milliseconds.
   * @returns {string} Formatted time string.
   * @private
   */
  _formatDelay(ms) {
    const seconds = Math.floor(ms / 1000);
    const hours = seconds / 3600;
    if (hours >= 1) return `${hours.toFixed(1)}h`;
    const minutes = seconds / 60;
    if (minutes >= 1) return `${Math.floor(minutes)}m`;
    return `${seconds}s`;
  }

  /**
   * Calculates the exponential backoff delay with a maximum cap.
   * @param {number} attempt - The current attempt number (1-indexed).
   * @returns {number} Delay in milliseconds.
   * @private
   */
  _getExponentialDelay(attempt) {
    const delayMs = 2 ** attempt * 1000;
    return Math.min(delayMs, this.maxDelay);
  }

  /**
   * Checks if an error is recoverable based on its message or type.
   * @param {Error} error - The error to check.
   * @param {Array<string>} recoverableMessages - List of error messages that trigger a retry.
   * @returns {boolean} True if the error is recoverable.
   * @private
   */
  _isRecoverable(error, recoverableMessages) {
    if (error.name === 'AbortError' || error.code === 'ERR_CANCELED') return false;
    if (error.name === 'ServiceDegradedError') return true;
    
    // Check HTTP status codes (500, 429, 503, etc.) in the wrapped object
    const httpStatus = error.response?.status;
    if (httpStatus && [429, 500, 502, 503, 504].includes(httpStatus)) {
      return true;
    }

    // Check Axios network error codes
    const networkErrors = ['ECONNABORTED', 'ETIMEDOUT', 'ECONNRESET', 'ERR_NETWORK'];
    if (error.code && networkErrors.includes(error.code)) {
      return true;
    }

    return recoverableMessages.some(msg => error.message.includes(msg));
  }

  /**
   * Executes an asynchronous function with retry logic.
   * @template T
   * @param {() => Promise<T>} fn - The asynchronous function to execute.
   * @param {object} options - Retry options.
   * @param {Array<string>} [options.recoverableErrors] - Error messages that trigger a retry.
   * @param {(attempt: number, error: Error, formattedDelay: string) => void} [options.onRetry] - Callback executed on each retry.
   * @param {AbortSignal} [options.signal] - Cancels requests and retry waits.
   * @returns {Promise<T>} The result of the function if successful.
   * @throws {Error} The last error encountered if all retries fail.
   */
  async execute(fn, { recoverableErrors = [], onRetry = null, signal } = {}) {
    let lastError = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt += 1) {
      signal?.throwIfAborted();
      try {
        const result = await fn();
        signal?.throwIfAborted();
        return result;
      } catch (error) {
        signal?.throwIfAborted();
        lastError = error;
        
        const isRecoverable = this._isRecoverable(error, recoverableErrors);

        if (!isRecoverable || attempt === this.maxRetries) {
          throw error;
        }

        const delayMs = this._getExponentialDelay(attempt);
        const formattedDelay = this._formatDelay(delayMs);
        
        if (onRetry) {
          onRetry(attempt, error, formattedDelay);
        }

        await delay(delayMs, undefined, { signal });
      }
    }

    throw lastError || new Error("Max retries reached without specific error.");
  }
}

export default RetryHandler;
