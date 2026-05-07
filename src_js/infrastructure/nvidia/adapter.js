import { ConversationState } from '../conversationState.js';
import { PayloadMapper } from '../payloadMapper.js';
import { TransportLayer } from '../transportLayer.js';
import axios from 'axios';
import { logger } from '../../core/logger.js';

export class NvidiaAdapter {
  constructor(userNickname = 'user', agentNickname = 'assistant') {
    this.state = new ConversationState(userNickname, agentNickname);
    this.transport = new TransportLayer();
    this.currentModel = 'meta/llama-3.1-405b-instruct';
    this.systemInstruction = '';
    this.temperature = 0.7;
    this.lastPayload = null;
    this.apiKey = process.env.NVIDIA_API_KEY;
  }

  startChat(modelName, systemInstruction, temperature = 0.7) {
    this.currentModel = modelName || this.currentModel;
    this.systemInstruction = systemInstruction;
    this.temperature = temperature;
    this.state.hardReset();
    logger.info('NvidiaAdapter: Chat started', { model: this.currentModel, temperature });
  }

  _filterThoughts(text) {
    if (!text) return '';
    let cleaned = text.replace(/<(thought|reasoning)>[\s\S]*?<\/\1>/gi, '');
    cleaned = cleaned.replace(/^(\[\d{2}:\d{2}\]\s*<[^>]+>\s*)+/g, '');
    return cleaned.trim();
  }

  async sendMessage(message, role = 'user', maxTokens = 512) {
    // 1. Add message to state (IRC formatted)
    this.state.addMessage(role, message);

    // 2. Map to NVIDIA JSON
    const payload = PayloadMapper.toNvidia(
      this.state.getRawHistory(),
      this.systemInstruction,
      this.temperature
    );
    payload.model = this.currentModel;
    payload.max_tokens = maxTokens;
    this.lastPayload = payload;

    const url = 'https://integrate.api.nvidia.com/v1/chat/completions';
    const headers = { 'Authorization': `Bearer ${this.apiKey}` };

    try {
      logger.debug('NvidiaAdapter: Sending request', { model: this.currentModel, payload });
      const data = await this.transport.post(url, payload, headers);
      const rawContent = data.choices?.[0]?.message?.content || '';
      const content = this._filterThoughts(rawContent);
      
      if (content) {
        logger.info('NvidiaAdapter: Response received', { length: content.length });
        this.state.addMessage('model', content);
        return content;
      }
      logger.warn('NvidiaAdapter: Empty response received');
      return 'Error: Empty response from NVIDIA';
    } catch (e) {
      const errorMsg = e.response?.data?.error?.message || e.message;
      logger.error('NvidiaAdapter: Request failed', { error: errorMsg });
      return `Error: ${errorMsg}`;
    }
  }

  injectMessage(role, content, timestamp = null) {
    this.state.addMessage(role, content, timestamp);
  }

  hardReset(historyOverride = null) {
    this.state.hardReset(historyOverride);
    logger.info('NvidiaAdapter: State hard reset');
  }

  getHistory() {
    return this.state.getRawHistory();
  }

  popLastMessage() {
    this.state.popLastMessage();
  }

  updateNicknames(userNickname, agentNickname) {
    this.state.userNickname = userNickname;
    this.state.agentNickname = agentNickname;
  }

  async getAvailableModels() {
  
      if (!this.apiKey) {
        console.error('NVIDIA_API_KEY is not defined in environment variables.');
        return [];
      }
    try {
      const url = 'https://integrate.api.nvidia.com/v1/models';
      const headers = { 'Authorization': `Bearer ${this.apiKey}` };
      const data = await this.transport.get(url, {}, headers);
      const models = data.data?.map(m => m.id) || [];
      logger.info('NvidiaAdapter: Models fetched', { count: models.length });
      return models;
    } catch (e) {
      logger.error('NvidiaAdapter: Error fetching models', { error: e.message });
      return [];
    }
  }

  async checkAvailability(modelName) {
    try {
      const url = 'https://integrate.api.nvidia.com/v1/chat/completions';
      const headers = { 'Authorization': `Bearer ${this.apiKey}` };
      const payload = {
        model: modelName,
        messages: [{ role: 'user', content: 'hi' }],
        max_tokens: 1
      };

      // Implementamos el timeout de 1 segundo y la lógica de 404
      await axios.post(url, payload, {
        headers,
        timeout: 1000
      });
      return true;
    } catch (e) {
      if (e.response && e.response.status === 404) {
        return false; // No disponible
      }
      // Si es timeout o cualquier otro error, asumimos que está disponible
      return true;
    }
  }

  countTokens(contents) {
    const totalChars = contents.reduce((acc, msg) => acc + (msg.text?.length || 0), 0);
    return Math.floor(totalChars / 4);
  }

  async close() {
    // TransportLayer uses axios, no persistent connection to close
  }
}