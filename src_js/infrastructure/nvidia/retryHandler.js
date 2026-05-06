import { logger } from '../../core/logger.js';

export class NvidiaRetryHandler {
  constructor(maxRetries = 5, callback = null) {
    this.maxRetries = maxRetries;
    this.callback = callback;
  }

  setCallback(callback) {
    this.callback = callback;
  }

  async execute(func, ...args) {
    let retries = 0;
    while (true) {
      try {
        return await func(...args);
      } catch (e) {
        const status = e.response?.status;
        if (retries >= this.maxRetries) throw e;

        let delay = Math.pow(2, retries) * 1000;
        let msg = '';

        if (status === 429) {
          const retryAfter = e.response.headers['retry-after'];
          if (retryAfter && !isNaN(retryAfter)) {
            delay = parseInt(retryAfter, 10) * 1000;
          }
          msg = `Rate limited (429). Retrying in ${delay / 1000}s...`;
        } else if ([500, 502, 503, 504].includes(status)) {
          msg = `Server error (${status}). Retrying in ${delay / 1000}s...`;
        } else if (status === 404) {
          logger.error('Model not found (404). Stopping execution.');
          throw e;
        } else {
          msg = `Unexpected error ${e.message}. Retrying in ${delay / 1000}s...`;
        }

        logger.warn(msg);
        if (this.callback) this.callback(msg);

        await new Promise(resolve => setTimeout(resolve, delay));
        retries++;
      }
    }
  }
}