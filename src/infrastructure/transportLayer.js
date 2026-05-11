import axios from 'axios';

export class TransportLayer {
  /**
   * Generic HTTP GET request
   */
  async get(url, params = {}, headers = {}) {
    try {
      const response = await axios.get(url, { params, headers, timeout: 60000 });
      return response.data;
    } catch (e) {
      throw e;
    }
  }

  /**
   * Generic HTTP POST request with basic retry logic
   */
  async post(url, payload, headers = {}, retries = 3) {
    let lastError;
    for (let i = 0; i < retries; i++) {
      try {
        const response = await axios.post(url, payload, { headers, timeout: 60000 });
        return response.data;
      } catch (e) {
        lastError = e;
        // Retry on 429 (Rate Limit) or 5xx (Server Error)
        const status = e.response?.status;
        const isTimeout = e.code === 'ECONNABORTED';
        if (!isTimeout && status !== 429 && (status < 500 || status > 599)) {
          break; 
        }
        // Exponential backoff
        await new Promise(res => setTimeout(res, Math.pow(2, i) * 1000));
      }
    }
    throw lastError;
  }
}