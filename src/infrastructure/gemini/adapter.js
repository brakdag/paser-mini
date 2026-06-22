import axios from "axios";
import axiosRetry from "axios-retry";
import logger from "../../core/logger.js";
import BaseAdapter from "../baseAdapter.js";
import IRCFormatter from "../../utils/ircFormatter.js";
import {
  GeminiSafetyError,
  GeminiEmptyResponseError,
} from "../../core/exceptions.js";

class GeminiAdapter extends BaseAdapter {
  constructor(
    ui,
    configManager,
    userNickname = "user",
    agentNickname = "assistant",
  ) {
    super(ui, configManager, userNickname, agentNickname);
    this.apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    this.history = [];
    this.currentModel = "models/gemma-4-26b-a4b-it";
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
        const time = IRCFormatter.getTimestamp();
        const msg = `[${time}] -!- [GeminiAdapter] API Retry ${retryCount}/5 due to: ${error.response?.status || error.message}`;
        logger.warn(msg);
        if (this.ui && this.ui.displayInfo) {
          const status = error.response?.status || error.message;
          this.ui.displayInfo(
            `Reintentando conexión... (${retryCount}/5) | Error: ${status}`,
          );
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
    const contents = this.history.map((c) => {
      const role = c.role === "server" ? "user" : c.role;
      const nickname =
        role === "user" ? this.ui.userNickname : this.ui.agentNickname;

      const parts = c.parts.map((p) => {
        if (p && typeof p === "object" && p.inline_data) {
          return p;
        }

        let textContent;
        if (typeof p === "object" && p.text) {
          textContent = p.text;
        } else if (typeof p === "string") {
          textContent = p;
        } else {
          textContent = JSON.stringify(p);
        }

        return {
          text: IRCFormatter.formatMessage(nickname, textContent, c.timestamp),
        };
      });

      return { role, parts };
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

  _createParts(content) {
    if (Array.isArray(content)) {
      return content.flatMap((m) => {
        if (typeof m === "string") return [{ text: m }];
        if (m && typeof m === "object" && m.mime_type && m.data) {
          return [
            { inline_data: { mime_type: m.mime_type, data: m.data } },
            { text: `Image resolution: ${m.resolution || "unknown"}` },
          ];
        }
        return [{ text: m === undefined ? "" : JSON.stringify(m) }];
      });
    }
    if (typeof content === "string") {
      return [{ text: content }];
    }
    if (
      content &&
      typeof content === "object" &&
      content.mime_type &&
      content.data
    ) {
      return [
        { inline_data: { mime_type: content.mime_type, data: content.data } },
        { text: `Image resolution: ${content.resolution || "unknown"}` },
      ];
    }
    return [{ text: content === undefined ? "" : JSON.stringify(content) }];
  }

  async sendMessage(message, role = "user") {
    await this._applyRateLimit();
    const timestamp = IRCFormatter.getTimestamp();
    const parts = this._createParts(message);

    this.history.push({
      role,
      parts,
      timestamp,
    });

    const payload = this._buildPayload();
    this.lastPayload = payload;
    const modelName = this.currentModel.replace(/^models\//, "");
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${this.apiKey}`;

    try {
      const response = await this.client.post(url, payload);
      const { data } = response;

      const { candidates } = data;
      if (!candidates || candidates.length === 0) {
        throw new GeminiEmptyResponseError(
          "No response candidates returned (possible safety block).",
        );
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
        const msgTimestamp = IRCFormatter.getTimestamp();

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
    const ts = timestamp || IRCFormatter.getTimestamp();
    const parts = this._createParts(content);

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
      const { data } = response;
      return data.models.map((m) => m.name);
    } catch (e) {
      console.error(`Error fetching models: ${e.message}`);
      return ["models/gemini-2.0-flash", "models/gemini-1.5-flash"];
    }
  }

  async checkAvailability(modelName) {
    try {
      const name = modelName.replace(/^models\//, "");
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${name}:generateContent?key=${this.apiKey}`;
      const payload = { contents: [{ role: "user", parts: [{ text: "hi" }] }] };
      await this.client.post(url, payload);
      return true;
    } catch (e) {
      const status = e.response?.status;
      if (status === 404 || status === 400) return false;
      return true;
    }
  }

  getVariants() {
    return [
      { name: "flash", model: "models/gemini-2.0-flash", temp: 0.5 },
      { name: "high", model: "models/gemini-2.0-pro-exp-02-05", temp: 0.7 },
      { name: "pro", model: "models/gemini-1.5-pro", temp: 0.7 },
    ];
  }
}

export default GeminiAdapter;

