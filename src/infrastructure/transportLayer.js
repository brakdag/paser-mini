import axios from 'axios';

export class TransportLayer {
  /**
   * Generic HTTP GET request
   */
  async get(url, params = {}, headers = {}) {
    const response = await axios.get(url, { params, headers, timeout: 60000 });
    return response.data;
  }

  /**
   * Generic HTTP POST request with basic retry logic
   */
  async post(url, payload, headers = {}, retries = 3) {
    const run = async (attempt) => {
      try {
        const response = await axios.post(url, payload, { headers, timeout: 60000 });
        return response.data;
      } catch (e) {
        const status = e.response?.status;
        const isTimeout = e.code === 'ECONNABORTED';
        const isRetryable = !isTimeout && (status === 429 || (status >= 500 && status <= 599));

        if (attempt >= retries - 1 || !isRetryable) {
          throw e;
        }

        // Exponential backoff
        await new Promise((resolve) => {
          setTimeout(resolve, 2 ** attempt * 1000);
        });
        return run(attempt + 1);
      }
    };
    return run(0);
  }
}
