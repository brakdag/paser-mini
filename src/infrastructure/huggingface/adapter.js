import axios from "axios";
import BaseAdapter from "../baseAdapter.js";
import logger from "../../core/logger.js";
import IRCFormatter from "../../utils/ircFormatter.js";
import RetryHandler from "../../utils/retryHandler.js";

class HuggingFaceAdapter extends BaseAdapter {
  constructor(ui, configManager, userNickname = "user", agentNickname = "assistant") {
    super(ui, configManager, userNickname, agentNickname);
    this.apiKey = process.env.HUGGINGFACE_API_KEY;
    this.history = [];
    this.currentModel = "meta-llama/Meta-Llama-3-8B-Instruct";
    this.systemInstruction = null;
    this.temperature = 0.7;

    this._configureClient();
    this.retryHandler = new RetryHandler();
    this.recoverableErrors = ["Empty response from HuggingFace"];
  }

  _configureClient() {
    this.client = axios.create({
      baseURL: "https://router.huggingface.co/v1",
      timeout: 600000,
      headers: {
        "Authorization": `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
    });
  }

  startChat(modelName, systemInstruction, temperature = 0.7) {
    this.currentModel = modelName || this.currentModel;
    this.systemInstruction = systemInstruction;
    this.temperature = temperature;
    if (this.systemInstruction) {
      if (this.history.length > 0 && this.history[0].role === "system") {
        this.history[0].content = this.systemInstruction;
      } else {
        this.injectMessage("system", this.systemInstruction);
      }
    }
  }

  async sendMessage(message, role = "user") {
    const timestamp = IRCFormatter.getTimestamp();
    this.injectMessage(role, message, timestamp);
    const historyLengthBefore = this.history.length;

    const payload = this._preparePayload();

    try {
      return await this.retryHandler.execute(async () => {
        try {
          logger.info(`[HuggingFaceAdapter] Requesting: ${this.client.defaults.baseURL}/chat/completions`);
          logger.info(`[HuggingFaceAdapter] Payload: ${JSON.stringify(payload)}`);

          const response = await this.client.post("/chat/completions", payload);
          return this._handleResponse(response);
        } catch (error) {
          throw this._handleApiError(error);
        }
      }, {
        recoverableErrors: this.recoverableErrors,
        onRetry: (attempt, error, formattedDelay) => {
          logger.warn(`[HuggingFaceAdapter] Retrying in ${formattedDelay}... (${attempt}/15) due to: ${error.message}`);
          if (this.ui && this.ui.displayInfo) {
            this.ui.displayInfo(`Reintentando HuggingFace en ${formattedDelay}... (${attempt}/15) | Error: ${error.message}`);
          }
        }
      });
    } catch (error) {
      if (this.history.length === historyLengthBefore) {
        this.popLastMessage();
      }
      throw error;
    }
  }

  _preparePayload() {
    return {
      model: this.currentModel,
      messages: this.history.map(({ role: msgRole, content, timestamp }) => ({
        role: msgRole,
        content: this.formatTextForPayload(msgRole, content, timestamp)
      })),
      temperature: this.temperature,
    };
  }

  _handleResponse(response) {
    const textContent = response.data.choices[0].message.content;

    if (textContent) {
      const msgTimestamp = IRCFormatter.getTimestamp();
      this.injectMessage("assistant", textContent, msgTimestamp);
      return textContent;
    }

    throw new Error("Empty response from HuggingFace");
  }

  _handleApiError(error) {
    const errorMsg = error.response?.data?.error?.message || error.message;
    const apiError = new Error(errorMsg);
    apiError.name = "APIError";
    apiError.response = error.response;
    apiError.code = error.code;
    return apiError;
  }

  injectMessage(role, content, timestamp = null) {
    const apiRole = this._normalizeRole(role);
    const finalContent = this._normalizeContent(content, apiRole);

    this.history.push({
      role: apiRole,
      content: finalContent,
      timestamp: timestamp || IRCFormatter.getTimestamp(),
    });
  }

  _normalizeRole(role) {
    if (role === this.userNickname) return "user";
    if (role === this.agentNickname) return "assistant";
    if (role === "server") return "user";
    return role;
  }

  _normalizeContent(content, role) {
    let finalContent = content;
    if (content && typeof content === 'object' && content.mime_type && content.data) {
      finalContent = [
        { type: "text", text: `Image resolution: ${content.resolution || 'unknown'}` },
        { type: "image_url", image_url: { url: `data:${content.mime_type};base64,${content.data}` } }
      ];
    } else if (Array.isArray(content)) {
      finalContent = content.join("\n");
    }

    if (typeof finalContent === 'string' && role === 'assistant') {
      finalContent = finalContent.replace(/<thought>[\s\S]*?<\/thought>/gi, '').trim();
    }
    return finalContent;
  }

  popLastMessage() {
    if (this.history.length > 0) {
      this.history.pop();
    }
  }

  hardReset(historyOverride = null) {
    this.history = historyOverride || [];
    if (this.systemInstruction) {
      this.injectMessage("system", this.systemInstruction);
    }
    logger.info("[HuggingFaceAdapter] History hard reset");
  }

  getHistory() {
    return this.history;
  }

  async getAvailableModels() {
    try {
      const response = await this.client.get("/models");
      return response.data.data.map((m) => m.id);
    } catch (error) {
      logger.error(`[HuggingFaceAdapter] Error fetching models: ${error.message}`);
      return ["meta-llama/Meta-Llama-3-8B-Instruct", "mistralai/Mistral-7B-Instruct-v0.2"];
    }
  }

  async checkAvailability(modelName) {
    try {
      await this.client.post("/chat/completions", {
        model: modelName,
        messages: [{ role: "user", content: "hi" }],
        max_tokens: 1,
      });
      return true;
    } catch (error) {
      const status = error.response?.status;
      if (status === 404 || status === 400) return false;
      return true;
    }
  }
}

export default HuggingFaceAdapter;
