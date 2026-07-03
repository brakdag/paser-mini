/**
 * Handles exponential backoff retries with a maximum cap.
 */
class RetryHandler {
  /**
   * Creates an instance of RetryHandler.
   * @param {number} maxRetries - Maximum number of retry attempts.
   * @param {number} maxDelay - Maximum delay between retries in milliseconds.
   */
  constructor(maxRetries = 15, maxDelay = 28800000) {
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
    if (minutes >= 1) return `${minutes.toFixed(0)}m`;
    return `${seconds}s`;
  }

  /**
   * Calculates the exponential backoff delay with a maximum cap.
   * @param {number} attempt - The current attempt number (1-indexed).
   * @returns {number} Delay in milliseconds.
   * @private
   */
  _getExponentialDelay(attempt) {
    const delay = 2 ** attempt * 1000;
    return Math.min(delay, this.maxDelay);
  }

  /**
   * Checks if an error is recoverable based on its message or type.
   * @param {Error} error - The error to check.
   * @param {Array<string>} recoverableMessages - List of error messages that trigger a retry.
   * @returns {boolean} True if the error is recoverable.
   * @private
   */
  _isRecoverable(error, recoverableMessages) {
    if (error.name === 'ServiceDegradedError') return true;
    return recoverableMessages.some(msg => error.message.includes(msg));
  }

  /**
   * Executes an asynchronous function with retry logic.
   * @param {() => Promise<string>} fn - The asynchronous function to execute.
   * @param {object} options - Retry options.
   * @param {Array<string>} [options.recoverableErrors] - Error messages that trigger a retry.
   * @param {(attempt: number, error: Error, formattedDelay: string) => void} [options.onRetry] - Callback executed on each retry.
   * @returns {Promise<string>} The result of the function if successful.
   * @throws {Error} The last error encountered if all retries fail.
   */
  async execute(fn, { recoverableErrors = [], onRetry = null } = {}) {
    let lastError = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt += 1) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        
        const isAxiosNetworkError = error.isAxiosError && (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT' || error.code === 'ECONNRESET');
        const isRecoverable = isAxiosNetworkError || this._isRecoverable(error, recoverableErrors);

        if (!isRecoverable) {
          throw error;
        }

        const delay = this._getExponentialDelay(attempt);
        const formattedDelay = this._formatDelay(delay);
        
        if (onRetry) {
          onRetry(attempt, error, formattedDelay);
        }

        await new Promise((resolve) => {
          setTimeout(resolve, delay);
        });
      }
    }

    throw lastError || new Error("Max retries reached without specific error.");
  }
}

export default RetryHandler;
