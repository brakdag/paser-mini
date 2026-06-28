import logger from "../../core/logger.js";

const DEFAULT_BACKOFF_MS = 1000;
const RETRYABLE_SERVER_ERRORS = [500, 502, 503, 504];

class NvidiaRetryHandler {
  constructor(maxRetries = 5000, callback = null) {
    this.maxRetries = maxRetries;
    this.callback = callback;
  }

  setCallback(callback) {
    this.callback = callback;
  }

  async execute(func, ...args) {
    const run = async (retries) => {
      try {
        return await func(...args);
      } catch (e) {
        const status = e.response?.status;
        if (retries >= this.maxRetries) throw e;

        const { delay, msg } = this._calculateRetryStrategy(e, status, retries);

        if (delay === null) throw e;

        logger.warn(msg);
        if (this.callback) this.callback(msg);

        await new Promise((resolve) => setTimeout(resolve, delay));
        return run(retries + 1);
      }
    };
    return run(0);
  }

  _calculateRetryStrategy(error, status, retries) {
    let delay = Math.pow(2, retries) * DEFAULT_BACKOFF_MS;
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