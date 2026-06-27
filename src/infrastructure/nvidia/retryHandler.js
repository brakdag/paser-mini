import logger from "../../core/logger.js";

/**
 *
 */
class NvidiaRetryHandler {
  /**
   *
   * @param maxRetries
   * @param callback
   */
  constructor(maxRetries = 5000, callback = null) {
    this.maxRetries = maxRetries;
    this.callback = callback;
  }

  /**
   *
   * @param callback
   */
  setCallback(callback) {
    this.callback = callback;
  }

  /**
   *
   * @param func
   * @param {...any} args
   */
  async execute(func, ...args) {
    /**
     *
     * @param retries
     */
    const run = async (retries) => {
      try {
        return await func(...args);
      } catch (e) {
        const status = e.response?.status;
        if (retries >= this.maxRetries) throw e;

        let delay = 2 ** retries * 1000;
        let msg = "";

        if (status === 429) {
          const retryAfter = e.response.headers["retry-after"];
          if (retryAfter && !Number.isNaN(Number(retryAfter))) {
            delay = parseInt(retryAfter, 10) * 1000;
          }
          msg = `Rate limited (429). Retrying in ${delay / 1000}s...`;
        } else if ([500, 502, 503, 504].includes(status)) {
          msg = `Server error (${status}). Retrying in ${delay / 1000}s...`;
        } else if (status === 404) {
          logger.error("Model not found (404). Stopping execution.");
          throw e;
        } else {
          msg = `Unexpected error ${e.message}. Retrying in ${delay / 1000}s...`;
        }

        logger.warn(msg);
        if (this.callback) this.callback(msg);

        await new Promise((resolve) => {
          setTimeout(resolve, delay);
        });
        return run(retries + 1);
      }
    };
    return run(0);
  }
}

export default NvidiaRetryHandler;
