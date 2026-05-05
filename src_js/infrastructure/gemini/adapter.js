import axios from 'axios';

export class GeminiAdapter {
  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    this.history = [];
    this.currentModel = 'gemini-2.0-flash';
    this.systemInstruction = null;
    this.temperature = 0.7;
  }

  startChat(modelName, systemInstruction, temperature = 0.7) {
    this.currentModel = modelName || this.currentModel;
    this.systemInstruction = systemInstruction;
    this.temperature = temperature;
    this.history = [];
  }

  _buildPayload() {
    const contents = JSON.parse(JSON.stringify(this.history));
    const payload = {
      contents: contents,
      generationConfig: {
        temperature: this.temperature
      }
    };

    if (this.systemInstruction) {
      if (this.currentModel && this.currentModel.toLowerCase().includes('gemma')) {
        if (contents.length > 0 && contents[0].role === 'user') {
          contents[0].parts[0].text = `${this.systemInstruction}\n\n${contents[0].parts[0].text}`;
        } else {
          payload.contents.push({
            role: 'user',
            parts: [{ text: this.systemInstruction }]
          });
        }
      } else {
        payload.systemInstruction = {
          parts: [{ text: this.systemInstruction }]
        };
      }
    }

    return payload;
  }

  async sendMessage(message, role = 'user') {
    const parts = [{ text: message }];
    this.history.push({ role, parts });

    const payload = this._buildPayload();
        const modelName = this.currentModel.replace(/^models\//, '');
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${this.apiKey}`;

    try {
      const response = await axios.post(url, payload);
      const data = response.data;

      const candidates = data.candidates;
      if (!candidates || candidates.length === 0) {
        return 'Error: No response candidates returned (possible safety block).';
      }

      const candidate = candidates[0];
      if (candidate.finishReason === 'SAFETY') {
        return 'Error: Response blocked by safety filters.';
      }

      const content = candidate.content;
      if (!content || !content.parts || content.parts.length === 0) {
        return 'Error: No content parts returned.';
      }

      const textContent = content.parts.map(p => p.text).join('');
      if (textContent) {
        this.history.push({ role: 'model', parts: [{ text: textContent }] });
        return textContent;
      }

      return 'Error: Empty response';
    } catch (e) {
      const errorMsg = e.response?.data?.error?.message || e.message;
      return `Error: ${errorMsg}`;
    }
  }

  injectMessage(role, content) {
    this.history.push({ role, parts: [{ text: content }] });
  }

  hardReset(historyOverride = null) {
    this.history = historyOverride || [];
  }

  getHistory() {
    return this.history;
  }

  popLastMessage() {
    if (this.history.length > 0) {
      this.history.pop();
    }
  }

  async getAvailableModels() {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${this.apiKey}`;
      const response = await axios.get(url);
      const models = response.data.models || [];
      return models
        .filter(m => m.name.includes('gemini') || m.name.includes('gemma'))
        .map(m => m.name);
    } catch (e) {
      console.error(`Error fetching models: ${e.message}`);
      return ['models/gemini-2.0-flash', 'models/gemini-1.5-flash'];
    }
  }
}