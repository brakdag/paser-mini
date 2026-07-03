import axios from "axios";
import logger from "../../core/logger.js";

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
   * Applies rate limiting based on RPM and TPM configurations.
   * @param {number} currentTokens - The estimated token count of the current request.
   * @returns {Promise<void>} A promise that resolves when the rate limit wait is over.
   */
  async applyRateLimit(currentTokens = 1000) {
    const rpmLimit = this._calculateRpmLimit(currentTokens);
    const minInterval = 60000 / rpmLimit;
    const elapsed = Date.now() - this.lastRequestTime;

    if (elapsed < minInterval) {
      const waitTime = minInterval - elapsed;
      logger.debug(`Nvidia Rate Limit: Waiting ${waitTime / 1000}s to maintain ${rpmLimit} RPM`);
      await new Promise((resolve) => {
        setTimeout(resolve, waitTime);
      });
    }
    this.lastRequestTime = Date.now();
  }

  /**
   * Calculates the current RPM limit.
   * @param {number} currentTokens - The estimated token count for the request.
   * @returns {number} The calculated requests-per-minute limit.
   */
  _calculateRpmLimit(currentTokens) {
    let rpmLimit = Math.max(1, parseInt(this.configManager.get("rpm_limit", 15), 10) || 1);
    const tpmLimit = parseInt(this.configManager.get("tpm_limit", 15000), 10);
    const autoRpmEnabled = this.configManager.get("auto_rpm_enabled", false);

    if (autoRpmEnabled && tpmLimit > 0) {
      rpmLimit = Math.max(1, Math.floor(tpmLimit / Math.max(currentTokens, 1000)));
      logger.debug(`Nvidia Auto-RPM: Adjusted limit to ${rpmLimit} based on tokens`);
    }
    return rpmLimit;
  }

  /**
   * Estimates token count based on character length.
   * @param {Array<object>} messages - The array of message objects to estimate.
   * @returns {number} The estimated token count.
   */
  _estimateTokens(messages) {
    return messages?.reduce(
      (acc, msg) => acc + Math.floor((msg.content?.length || 0) / 4),
      0
    ) || 1000;
  }

  /**
   * Sends a chat completion request.
   * @param {object} payload - The request payload containing model and messages.
   * @param {boolean} stream - Whether to stream the response.
   * @returns {Promise<object>} The API response data.
   */
  async chatCompletions(payload, stream = false, timeout = 600000) {
    const url = "/chat/completions";
    const requestPayload = { ...payload, stream };

    await this.applyRateLimit(this._estimateTokens(requestPayload.messages));

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
    await this.applyRateLimit();
    const response = await this.client.get(`/${endpoint}`);
    return response.data;
  }
}

export default NvidiaRestClient;
