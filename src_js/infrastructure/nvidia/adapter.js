import { NvidiaRestClient } from './restClient.js';
import { NvidiaRetryHandler } from './retryHandler.js';
import { ConfigManager } from '../../core/configManager.js';

export class NvidiaAdapter {
  constructor() {
    this.configManager = new ConfigManager();
    this.client = new NvidiaRestClient(this.configManager);
    this.retryHandler = new NvidiaRetryHandler();
    
    this.currentModel = 'meta/llama-3.1-405b-instruct';
    this.history = [];
    this.systemInstruction = '';
    this.temperature = 0.7;
  }

  setRetryCallback(callback) {
    this.retryHandler.setCallback(callback);
  }

  startChat(modelName, systemInstruction, temperature = 0.7) {
    this.currentModel = modelName || this.currentModel;
    this.systemInstruction = systemInstruction;
    this.temperature = temperature;
    this.history = [{ role: 'system', content: systemInstruction }];
  }

  async sendMessage(message, role = 'user', maxTokens = 512) {
    const apiRole = role === 'model' ? 'assistant' : role;
    this.history.push({ role: apiRole, content: message });

    const payload = {
      model: this.currentModel,
      messages: this.history,
      temperature: this.temperature,
      max_tokens: maxTokens
    };

    try {
      // Execute via retry handler to ensure resilience against 429s and 5xxs
      const response = await this.retryHandler.execute(
        (p) => this.client.chatCompletions(p),
        payload
      );

      const content = response.choices[0].message.content;
      this.history.push({ role: 'assistant', content: content });
      return content;
    } catch (e) {
      const errorMsg = e.response?.data?.error?.message || e.message;
      return `Error: ${errorMsg}`;
    }
  }

  async getAvailableModels() {
    try {
      const data = await this.client.get('models');
      return data.data.map(m => m.id);
    } catch (e) {
      return ['meta/llama-3.1-405b-instruct'];
    }
  }

  async checkAvailability(modelName) {
    try {
      const payload = {
        model: modelName,
        messages: [{ role: 'user', content: 'hi' }],
        max_tokens: 1
      };
      await this.retryHandler.execute((p) => this.client.chatCompletions(p), payload);
      return true;
    } catch (e) {
      return false;
    }
  }

  hardReset(historyOverride = null) {
    this.history = historyOverride || [{ role: 'system', content: this.systemInstruction }];
  }

  getHistory() { return this.history; }
  
  injectMessage(role, content) {
    const apiRole = role === 'model' ? 'assistant' : role;
    this.history.push({ role: apiRole, content });
  }

  countTokens(contents) {
    const totalChars = contents.reduce((acc, msg) => acc + (msg.content?.length || 0), 0);
    return Math.floor(totalChars / 4);
  }

  async close() {
    await this.client.close();
  }
}