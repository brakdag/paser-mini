import axios from "axios";
import axiosRetry from "axios-retry";
import logger from "../../core/logger.js";
import BaseAdapter from "../baseAdapter.js";
import { GeminiSafetyError, GeminiEmptyResponseError } from "../../core/exceptions.js";

class GeminiAdapter extends BaseAdapter {
  constructor(ui, configManager, userNickname = "user", agentNickname = "assistant") {
    super(ui, configManager, userNickname, agentNickname);
    this.apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    this.history = [];
    this.currentModel = "gemini-2.0-flash";
    this.systemInstruction = null;
    this.temperature = 0.7;
    this.lastPayload = null;
    this.renderingMode = "IRC";
    this.lastRequestTime = 0;
    this.rpmLimit = 15;

    this.client = axios.create({
      timeout: 600000,
    });

    axiosRetry(this.client, {
      retries: 5,
      retryDelay: axiosRetry.exponentialDelay,
      retryCondition: (error) => {
        const status = error.response?.status;
        const recoverableStatuses = [429, 500, 502, 503, 504];
        return (
          axiosRetry.isNetworkOrIdempotentRequestError(error) ||
          recoverableStatuses.includes(status)
        );
      },
      onRetry: (retryCount, error) => {
        const time = new Date().toLocaleTimeString("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        });
        const msg = `[${time}] -!- [GeminiAdapter] API Retry ${retryCount}/5 due to: ${error.response?.status || error.message}`;
        logger.warn(msg);
        if (this.ui && this.ui.displayInfo) {
          const status = error.response?.status || error.message;
          this.ui.displayInfo(`Reintentando conexión... (${retryCount}/5) | Error: ${status}`);
        }
      },
    });
  }

  async _applyRateLimit() {
    const minInterval = 60000 / this.rpmLimit;
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;

    if (elapsed < minInterval) {
      const waitTime = minInterval - elapsed;
      logger.debug(
        `[GeminiAdapter] Rate Limit: Waiting ${waitTime / 1000}s to maintain ${this.rpmLimit} RPM`,
      );
      await new Promise((resolve) => {
        setTimeout(resolve, waitTime);
      });
    }
    this.lastRequestTime = Date.now();
  }

  setRenderingMode(mode) {
    this.renderingMode = mode;
  }

  startChat(modelName, systemInstruction, temperature = 0.7) {
    this.currentModel = modelName || this.currentModel;
    this.systemInstruction = systemInstruction;
    this.temperature = temperature;
  }

  _buildPayload() {
    const contents = JSON.parse(JSON.stringify(this.history)).map((c) => {
      const rest = { ...c };
      delete rest.timestamp;
      if (rest.role === "server") {
        rest.role = "user";
      }
      return rest;
    });
    const payload = {
      contents,
      generationConfig: {
        temperature: this.temperature,
      },
    };

    if (this.systemInstruction) {
      payload.systemInstruction = {
        parts: [{ text: this.systemInstruction }],
      };
    }

    return payload;
  }

  _filterThoughts(text) {
    if (!text) return "";
    let cleaned = text.replace(/<(thought|reasoning)>[\s\S]*?<\/\1>/gi, "");
    cleaned = cleaned.replace(/^(\[\d{2}:\d{2}:\d{2}\]\s*<[^>]+>\s*)+/g, "");
    return cleaned.trim();
  }

  async sendMessage(message, role = "user") {
    await this._applyRateLimit();
    const timestamp = new Date().toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    
    let parts = [];
    if (Array.isArray(message)) {
      parts = message.flatMap((m) => {
        if (typeof m === 'string') return [{ text: m }];
        if (m && typeof m === 'object' && m.mime_type && m.data) {
          return [
            { inline_data: { mime_type: m.mime_type, data: m.data } },
            { text: `Image resolution: ${m.resolution || 'unknown'}` },
          ];
        }
        return [{ text: m === undefined ? "" : JSON.stringify(m) }];
      });
    } else if (typeof message === 'string') {
      parts = [{ text: message }];
    } else if (message && typeof message === 'object' && message.mime_type && message.data) {
      parts = [
        { inline_data: { mime_type: message.mime_type, data: message.data } },
        { text: `Image resolution: ${message.resolution || 'unknown'}` },
      ];
    } else {
      parts = [{ text: message === undefined ? "" : JSON.stringify(message) }];
    }

    this.history.push({
      role,
      parts,
      timestamp,
    });

    const payload = this._buildPayload();
    this.lastPayload = JSON.parse(JSON.stringify(payload));
    const modelName = this.currentModel.replace(/^models\//, "");
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${this.apiKey}`;

    try {
      const response = await this.client.post(url, payload);
      const { data } = response;

      const { candidates } = data;
      if (!candidates || candidates.length === 0) {
        throw new GeminiEmptyResponseError("No response candidates returned (possible safety block).");
      }

      const candidate = candidates[0];
      if (candidate.finishReason === "SAFETY") {
        throw new GeminiSafetyError("Response blocked by safety filters.");
      }

      const { content } = candidate;
      if (!content || !content.parts || content.parts.length === 0) {
        throw new GeminiEmptyResponseError("No content parts returned.");
      }

      let textContent = content.parts.map((p) => p.text).join("");
      textContent = this._filterThoughts(textContent);

      if (textContent) {
        const msgTimestamp = new Date().toLocaleTimeString("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        });
        
        this.history.push({
          role: "model",
          parts: [{ text: textContent }],
          timestamp: msgTimestamp,
        });
        return textContent;
      }

      throw new GeminiEmptyResponseError("Empty response");
    } catch (e) {
      const errorMsg = e.response?.data?.error?.message || e.message;
      const error = new Error(errorMsg);
      error.name = "APIError";
      throw error;
    }
  }

  injectMessage(role, content, timestamp = null) {
    const ts =
      timestamp ||
      new Date().toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      });
    
    let parts = [];
    if (Array.isArray(content)) {
      parts = content.flatMap((m) => {
        if (typeof m === 'string') return [{ text: m }];
        if (m && typeof m === 'object' && m.mime_type && m.data) {
          return [
            { inline_data: { mime_type: m.mime_type, data: m.data } },
            { text: `Image resolution: ${m.resolution || 'unknown'}` },
          ];
        }
        return [{ text: m === undefined ? "" : JSON.stringify(m) }];
      });
    } else if (typeof content === 'string') {
      parts = [{ text: content }];
    } else if (content && typeof content === 'object' && content.mime_type && content.data) {
      parts = [
        { inline_data: { mime_type: content.mime_type, data: content.data } },
        { text: `Image resolution: ${content.resolution || 'unknown'}` },
      ];
    } else {
      parts = [{ text: content === undefined ? "" : JSON.stringify(content) }];
    }

    this.history.push({
      role,
      parts,
      timestamp: ts,
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

  updateNicknames(userNickname, agentNickname) {
    this.userNickname = userNickname;
    this.agentNickname = agentNickname;
  }

  async getAvailableModels() {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${this.apiKey}`;
      const response = await this.client.get(url);
      const models = response.data.models || [];
      return models
        .filter((m) => m.name.includes("gemini") || m.name.includes("gemma"))
        .map((m) => m.name);
    } catch (e) {
      console.error(`Error fetching models: ${e.message}`);
      return ["models/gemini-2.0-flash", "models/gemini-1.5-flash"];
    }
  }
}

export default GeminiAdapter;