import { setTimeout as delay } from "node:timers/promises";
import RequestBudget from "./requestBudget.js";

/**
 * Handles exponential backoff retries with a maximum cap.
 */
class RetryHandler {
  /**
   * Creates an instance of RetryHandler.
   * @param {number} maxRetries - Maximum total attempts, including the initial request.
   * @param {number} maxDelay - Maximum delay between retries in milliseconds (default: 5 minutes).
   */
  constructor(maxRetries = 5, maxDelay = 300000) {
    this.maxRetries = maxRetries;
    this.maxDelay = maxDelay;
    this.maxElapsedMs = 600000;
    this.now = performance.now.bind(performance);
    this.wallNow = Date.now;
  }

  /**
   * @param {number} ms - Retry delay in milliseconds.
   * @param {AbortSignal} signal - Shared request cancellation.
   * @returns {Promise<void>} Completion of the interruptible delay.
   */
  async sleep(ms, signal) {
    await delay(ms, undefined, { signal });
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
    if (["AbortError", "TimeoutError", "UserInterruptException"].includes(error.name) || error.code === "ERR_CANCELED") return false;
    
    // Check HTTP status codes (500, 429, 503, etc.) in the wrapped object
    const httpStatus = error.response?.status;
    if (httpStatus) return [429, 500, 502, 503, 504].includes(httpStatus);
    if (error.name === "ServiceDegradedError") return true;

    // Check Axios network error codes
    const networkErrors = ['ECONNABORTED', 'ETIMEDOUT', 'ECONNRESET', 'ERR_NETWORK', 'ENOTFOUND', 'EAI_AGAIN', 'EHOSTUNREACH', 'ENETUNREACH', 'ECONNREFUSED', 'EPIPE'];
    if (error.code && networkErrors.includes(error.code)) {
      return true;
    }

    return recoverableMessages.some(msg => error.message.includes(msg));
  }

  /**
   * Reads Retry-After as delta seconds or an HTTP date, without shortening it.
   * @param {object} error - Provider error retaining its response headers.
   * @returns {number} Server delay in milliseconds; zero for an invalid header.
   */
  _serverDelay(error) {
    const headers = error.response?.headers;
    const value = headers?.get?.("retry-after") ?? headers?.["retry-after"] ?? headers?.["Retry-After"];
    if (typeof value !== "string" && typeof value !== "number") return 0;
    const text = String(value).trim();
    if (/^\d+$/u.test(text)) return Number(text) * 1000;
    if (!/[a-z]/iu.test(text)) return 0;
    const date = Date.parse(text);
    return Number.isFinite(date) ? Math.max(0, date - this.wallNow()) : 0;
  }

  /**
   * Retries only model generation, never tool execution or arbitrary side effects.
   * @template T
   * @param {(signal: AbortSignal) => Promise<T>} fn - One transport attempt.
   * @param {object} [options] - Request policy and cancellation.
   * @param {Array<string>} [options.recoverableErrors] - Provider domain failures to retry.
   * @param {(attempt: number, error: Error, formattedDelay: string) => void} [options.onRetry] - Retry notification.
   * @param {AbortSignal} [options.signal] - Caller cancellation.
   * @param {RequestBudget} [options.budget] - Deadline including prior rate-limit waits.
   * @returns {Promise<T>} Successful response.
   */
  async execute(fn, { recoverableErrors = [], onRetry = null, signal, budget } = {}) {
    if (!Number.isSafeInteger(this.maxRetries) || this.maxRetries <= 0) throw new RangeError("Attempt limit must be a positive integer");
    if (!Number.isSafeInteger(this.maxDelay) || this.maxDelay < 0 || this.maxDelay > 2147483647) throw new RangeError("Backoff cap must be a nonnegative timer-safe integer");
    const scope = budget || new RequestBudget(this.maxElapsedMs, signal, this.now);
    try {
      for (let attempt = 1; attempt <= this.maxRetries; attempt += 1) {
        scope.remaining();
        try {
          const result = await fn(scope.signal);
          scope.remaining();
          return result;
        } catch (error) {
          scope.remaining();
          if (attempt === this.maxRetries || !this._isRecoverable(error, recoverableErrors)) throw error;
          const delayMs = Math.max(this._getExponentialDelay(attempt), this._serverDelay(error));
          if (delayMs >= scope.remaining()) {
            scope.expire();
            scope.signal.throwIfAborted();
          }
          onRetry?.(attempt, error, this._formatDelay(delayMs));
          scope.remaining();
          await this.sleep(delayMs, scope.signal);
        }
      }
      throw new Error("Attempt budget exhausted");
    } catch (error) {
      scope.signal.throwIfAborted();
      throw error;
    } finally {
      if (!budget) scope.close();
    }
  }
}

export default RetryHandler;
