import axios from "axios";


/**
 * Low-level REST client for Nvidia API interactions.
 */
class NvidiaRestClient {
  /**
   * @param {object} configManager - The system configuration manager for API limits.
   */
  constructor(configManager) {
    this.apiKey = process.env.NVIDIA_API_KEY;
    this.baseUrl = "https://integrate.api.nvidia.com/v1";
    this.configManager = configManager;
    this.lastRequestTime = 0;
    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      timeout: 600000,
    });
  }



  /**
   * Sends a chat completion request.
   * @param {object} payload - The request payload containing model and messages.
   * @param {boolean} stream - Whether to stream the response.
   * @param {number} [timeout] - Optional request timeout in milliseconds.
   * @returns {Promise<object>} The API response data.
   */
  async chatCompletions(payload, stream = false, timeout = 600000) {
    const url = "/chat/completions";
    const requestPayload = { ...payload, stream };

    if (stream) {
      throw new Error("Streaming not yet implemented in JS RestClient");
    }

    const response = await this.client.post(url, requestPayload, { timeout });
    return response.data;
  }

  /**
   * Performs a GET request to a specific endpoint.
   * @param {string} endpoint - The API endpoint path.
   * @returns {Promise<object>} The API response data.
   */
  async get(endpoint) {
    const response = await this.client.get(`/${endpoint}`);
    return response.data;
  }
}

export default NvidiaRestClient;
