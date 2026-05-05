import axios from 'axios';

export class NvidiaAdapter {
  constructor() {
    this.apiKey = process.env.NVIDIA_API_KEY;
    this.baseUrl = 'https://integrate.api.nvidia.com/v1';
    this.currentModel = 'meta/llama-3.1-405b-instruct';
    this.history = [];
    this.systemInstruction = '';
    this.temperature = 0.7;
  }

  startChat(modelName, systemInstruction, temperature = 0.7) {
    this.currentModel = modelName || this.currentModel;
    this.systemInstruction = systemInstruction;
    this.temperature = temperature;
    // NVIDIA usa el rol 'system' para las instrucciones globales
    this.history = [{ role: 'system', content: systemInstruction }];
  }

  async _applyRateLimit(configManager) {
    const rpmLimit = parseInt(configManager.get('rpm_limit', 15), 10);
    const minInterval = 60000 / rpmLimit;
    
    if (this.lastRequestTime) {
      const elapsed = Date.now() - this.lastRequestTime;
      if (elapsed < minInterval) {
        const waitTime = minInterval - elapsed;
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
    this.lastRequestTime = Date.now();
  }

  async sendMessage(message, role = 'user') {
    const apiRole = role === 'model' ? 'assistant' : role;
    this.history.push({ role: apiRole, content: message });

    const payload = {
      model: this.currentModel,
      messages: this.history,
      temperature: this.temperature,
      max_tokens: 512
    };

    try {
      // Nota: En una implementación completa, pasaríamos el configManager aquí
      // Para simplificar, aplicamos un delay básico o confiamos en el servidor
      const response = await axios.post(`${this.baseUrl}/chat/completions`, payload, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      const content = response.data.choices[0].message.content;
      this.history.push({ role: 'assistant', content: content });
      return content;
    } catch (e) {
      const errorMsg = e.response?.data?.error?.message || e.message;
      return `Error: ${errorMsg}`;
    }
  }

  async getAvailableModels() {
    try {
      const response = await axios.get(`${this.baseUrl}/models`, {
        headers: { 'Authorization': `Bearer ${this.apiKey}` }
      });
      return response.data.data.map(m => m.id);
    } catch (e) {
      return ['meta/llama-3.1-405b-instruct'];
    }
  }

  async checkAvailability(modelName) {
    try {
      await axios.post(`${this.baseUrl}/chat/completions`, {
        model: modelName,
        messages: [{ role: 'user', content: 'hi' }],
        max_tokens: 1
      }, {
        headers: { 'Authorization': `Bearer ${this.apiKey}` }
      });
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
}