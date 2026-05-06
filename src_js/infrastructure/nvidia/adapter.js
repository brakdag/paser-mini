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
    this.lastPayload = null;
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
    this.history.push({ 
      role: apiRole, 
      content: message, 
      timestamp: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) 
    });

    const payload = {
      model: this.currentModel,
      messages: this.history.map(m => {
        const { timestamp, ...rest } = m;
        return rest;
      }),
      temperature: this.temperature,
      max_tokens: maxTokens
    };
    this.lastPayload = payload;

    try {
      // Execute via retry handler to ensure resilience against 429s and 5xxs
      const response = await this.retryHandler.execute(
        (p) => this.client.chatCompletions(p),
        payload
      );

      const content = response.choices[0].message.content;
      this.history.push({
        role: 'assistant',
        content: content,
        timestamp: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
      });
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