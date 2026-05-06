import axios from 'axios';

export class GeminiAdapter {
  constructor(userNickname = 'user', agentNickname = 'assistant') {
    this.apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    this.history = [];
    this.currentModel = 'gemini-2.0-flash';
    this.systemInstruction = null;
    this.temperature = 0.7;
    this.lastPayload = null;
    this.userNickname = userNickname;
    this.agentNickname = agentNickname;
  }

  startChat(modelName, systemInstruction, temperature = 0.7) {
    this.currentModel = modelName || this.currentModel;
    this.systemInstruction = systemInstruction;
    this.temperature = temperature;
    this.history = [];
  }

  _buildPayload() {
    const contents = JSON.parse(JSON.stringify(this.history)).map(c => {
      const { timestamp, ...rest } = c;
      // Map internal 'server' role to 'user' for API compatibility
      // The model will distinguish it by the text format ([HH:mm] Text)
      if (rest.role === 'server') {
        rest.role = 'user';
      }
      return rest;
    });
    const payload = {
      contents: contents,
      generationConfig: {
        temperature: this.temperature
      }
    };

    if (this.systemInstruction) {
      payload.systemInstruction = {
        parts: [{ text: this.systemInstruction }]
      };
    }

    return payload;
  }

  /**
   * Limpia los pensamientos internos del modelo para evitar que contaminen el historial
   * y causen bucles de razonamiento o ejecuciones falsas.
   */
  _filterThoughts(text) {
    if (!text) return '';
    // Elimina bloques <thought>...</thought> y cualquier cosa similar
    let cleaned = text.replace(/<(thought|reasoning)>[\s\S]*?<\/\1>/gi, '');
    
    // Elimina prefijos de IRC que el modelo pueda generar por imitación ([HH:mm] <Nick>)
    cleaned = cleaned.replace(/^(\[\d{2}:\d{2}\]\s*<[^>]+>\s*)+/g, '');
    
    return cleaned.trim();
  }

  _formatMessage(role, text, timestamp) {
    if (role === 'server' || text.startsWith('---') || text.startsWith('***') || text.startsWith('<TOOL_RESPONSE>')) {
      return `[${timestamp}] ${text}`;
    }
    const nickname = role === 'user' ? this.userNickname : this.agentNickname;
    return `[${timestamp}] <${nickname}> ${text}`;
  }

  async sendMessage(message, role = 'user') {
    const timestamp = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    const formattedMessage = this._formatMessage(role, message, timestamp);
    const parts = [{ text: formattedMessage }];
    this.history.push({
      role,
      parts,
      timestamp
    });

    const payload = this._buildPayload();
    this.lastPayload = payload;
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

      let textContent = content.parts.map(p => p.text).join('');
      
      // FILTRO CRÍTICO: Limpiamos los pensamientos antes de guardar en el historial
      textContent = this._filterThoughts(textContent);

      if (textContent) {
        const timestamp = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
        const formattedMessage = this._formatMessage('model', textContent, timestamp);
        this.history.push({
          role: 'model',
          parts: [{ text: formattedMessage }],
          timestamp
        });
        return textContent;
      }

      return 'Error: Empty response';
    } catch (e) {
      const errorMsg = e.response?.data?.error?.message || e.message;
      return `Error: ${errorMsg}`;
    }
  }

  injectMessage(role, content, timestamp = null) {
    const ts = timestamp || new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    const formattedMessage = this._formatMessage(role, content, ts);
    this.history.push({ 
      role, 
      parts: [{ text: formattedMessage }],
      timestamp: ts
    });
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