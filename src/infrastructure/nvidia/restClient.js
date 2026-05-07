import axios from 'axios';
import { logger } from '../../core/logger.js';

export class NvidiaRestClient {
  constructor(configManager) {
    this.apiKey = process.env.NVIDIA_API_KEY;
    this.baseUrl = 'https://integrate.api.nvidia.com/v1';
    this.configManager = configManager;
    this.lastRequestTime = 0;
    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      timeout: 60000
    });
  }

  async _applyRateLimit(currentTokens = 1000) {
    let rpmLimit = parseInt(this.configManager.get('rpm_limit', 15), 10);
    const tpmLimit = parseInt(this.configManager.get('tpm_limit', 15000), 10);
    const autoRpmEnabled = this.configManager.get('auto_rpm_enabled', false);

    if (autoRpmEnabled) {
      rpmLimit = Math.max(1, Math.floor(tpmLimit / Math.max(currentTokens, 1000)));
      logger.debug(`Nvidia Auto-RPM: Adjusted limit to ${rpmLimit} based on tokens`);
    }

    const minInterval = 60000 / rpmLimit;
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;

    if (elapsed < minInterval) {
      const waitTime = minInterval - elapsed;
      logger.debug(`Nvidia Rate Limit: Waiting ${waitTime / 1000}s to maintain ${rpmLimit} RPM`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    this.lastRequestTime = Date.now();
  }

  async chatCompletions(payload, stream = false) {
    const url = '/chat/completions';
    payload.stream = stream;

    const tokenEstimate = payload.messages?.reduce((acc, msg) => acc + Math.floor((msg.content?.length || 0) / 4), 0) || 1000;

    await this._applyRateLimit(tokenEstimate);

    if (stream) {
      // Streaming implementation would require a different axios config or fetch
      throw new Error('Streaming not yet implemented in JS RestClient');
    }

    const response = await this.client.post(url, payload);
    return response.data;
  }

  async get(endpoint) {
    await this._applyRateLimit();
    const response = await this.client.get(`/${endpoint}`);
    return response.data;
  }

  async close() {
    // Axios client doesn't require explicit closing like httpx
  }
}