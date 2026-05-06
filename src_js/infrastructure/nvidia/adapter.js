import { ConversationState } from '../conversationState.js';
import { PayloadMapper } from '../payloadMapper.js';
import { TransportLayer } from '../transportLayer.js';

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

    const url = 'https://infer.nvidia.com/v1/chat/completions';
    const headers = { 'Authorization': `Bearer ${this.apiKey}` };

    try {
      const data = await this.transport.post(url, payload, headers);
      const content = data.choices?.[0]?.message?.content || '';
      
      if (content) {
        this.state.addMessage('model', content);
        return content;
      }
      return 'Error: Empty response from NVIDIA';
    } catch (e) {
      return `Error: ${e.response?.data?.error?.message || e.message}`;
    }
  }

  injectMessage(role, content, timestamp = null) {
    this.state.addMessage(role, content, timestamp);
  }

  hardReset(historyOverride = null) {
    this.state.hardReset(historyOverride);
  }

  getHistory() {
    return this.state.getRawHistory();
  }

  popLastMessage() {
    this.state.popLastMessage();
  }

  async getAvailableModels() {
    try {
      const url = 'https://infer.nvidia.com/v1/models';
      const headers = { 'Authorization': `Bearer ${this.apiKey}` };
      const data = await this.transport.get(url, {}, headers);
      return data.data?.map(m => m.id) || [];
    } catch (e) {
      return ['meta/llama-3.1-405b-instruct'];
    }
  }

  async checkAvailability(modelName) {
    try {
      const url = 'https://infer.nvidia.com/v1/chat/completions';
      const headers = { 'Authorization': `Bearer ${this.apiKey}` };
      const payload = {
        model: modelName,
        messages: [{ role: 'user', content: 'hi' }],
        max_tokens: 1
      };
      await this.transport.post(url, payload, headers);
      return true;
    } catch (e) {
      return false;
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