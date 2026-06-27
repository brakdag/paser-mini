import axios from "axios";
import axiosRetry from "axios-retry";
import BaseAdapter from "../baseAdapter.js";
import logger from "../../core/logger.js";

/**
 *
 */
class GroqAdapter extends BaseAdapter {
  /**
   *
   * @param ui
   * @param configManager
   * @param userNickname
   * @param agentNickname
   */
  constructor(ui, configManager, userNickname = "user", agentNickname = "assistant") {
    super(ui, configManager, userNickname, agentNickname);
    this.apiKey = process.env.GROQ_API_KEY;
    this.history = [];
    this.currentModel = "llama3-8b-8192";
    this.systemInstruction = null;
    this.temperature = 0.7;

    this.client = axios.create({
      baseURL: "https://api.groq.com/openai/v1",
      timeout: 600000,
      headers: {
        "Authorization": `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
    });

    axiosRetry(this.client, {
      retries: 5,
      retryDelay: axiosRetry.exponentialDelay,
      /**
       *
       * @param error
       */
      retryCondition: (error) => {
        const status = error.response?.status;
        const recoverableStatuses = [429, 500, 502, 503, 504];
        return (
          axiosRetry.isNetworkOrIdempotentRequestError(error) ||
          recoverableStatuses.includes(status)
        );
      },
      /**
       *
       * @param retryCount
       * @param error
       */
      onRetry: (retryCount, error) => {
        const time = new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
        const msg = `[${time}] -!- [GroqAdapter] API Retry ${retryCount}/5 due to: ${error.response?.status || error.message}`;
        logger.warn(msg);
        if (this.ui && this.ui.displayInfo) {
          this.ui.displayInfo(`Reintentando Groq... (${retryCount}/5) | Error: ${error.response?.status || error.message}`);
        }
      },
    });
  }

  /**
   *
   * @param modelName
   * @param systemInstruction
   * @param temperature
   */
  startChat(modelName, systemInstruction, temperature = 0.7) {
    this.currentModel = modelName || this.currentModel;
    this.systemInstruction = systemInstruction;
    this.temperature = temperature;
    if (this.systemInstruction) {
      if (this.history.length > 0 && this.history[0].role === "system") {
        this.history[0].content = this.systemInstruction;
      } else {
        this.history.unshift({
          role: "system",
          content: this.systemInstruction,
          timestamp: new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }),
        });
      }
    }
  }

  /**
   *
   * @param message
   * @param role
   */
  async sendMessage(message, role = "user") {
    const timestamp = new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
    
    this.injectMessage(role, message, timestamp);

    const payload = {
      model: this.currentModel,
      messages: this.history.map(({ role: msgRole, content }) => ({ role: msgRole, content })),
      temperature: this.temperature,
    };
    this.lastPayload = payload;

    try {
      const response = await this.client.post("/chat/completions", payload);
      const textContent = response.data.choices[0].message.content;

      if (textContent) {
        const msgTimestamp = new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
        this.injectMessage("assistant", textContent, msgTimestamp);
        return textContent;
      }

      throw new Error("Empty response from Groq");
    } catch (e) {
      const errorMsg = e.response?.data?.error?.message || e.message;
      const error = new Error(errorMsg);
      error.name = "APIError";
      throw error;
    }
  }

  /**
   *
   * @param role
   * @param content
   * @param timestamp
   */
  injectMessage(role, content, timestamp = null) {
    let apiRole = role;
    if (role === this.userNickname) apiRole = "user";
    if (role === this.agentNickname || role === "model") apiRole = "assistant";
    if (role === "server") apiRole = "user";

    let finalContent = content;
    if (content && typeof content === 'object' && content.mime_type && content.data) {
      finalContent = [
        { type: "text", text: `Image resolution: ${content.resolution || 'unknown'}` },
        { type: "image_url", image_url: { url: `data:${content.mime_type};base64,${content.data}` } }
      ];
    } else if (Array.isArray(content)) {
      finalContent = content.join("\n");
    }

    if (typeof finalContent === 'string' && apiRole === 'assistant') {
      finalContent = finalContent.replace(/<thought>[\s\S]*?<\/thought>/gi, '').trim();
    }

    this.history.push({
      role: apiRole,
      content: finalContent,
      timestamp: timestamp || new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }),
    });
  }

  /**
   *
   */
  popLastMessage() {
    if (this.history.length > 0) {
      this.history.pop();
    }
  }

  /**
   *
   * @param historyOverride
   */
  hardReset(historyOverride = null) {
    this.history = historyOverride || [];
    if (this.systemInstruction) {
      this.injectMessage("system", this.systemInstruction);
    }
    logger.info("[GroqAdapter] History hard reset");
  }

  /**
   *
   */
  getHistory() {
    return this.history;
  }

  /**
   *
   */
  async getAvailableModels() {
    try {
      const response = await this.client.get("/models");
      return response.data.data.map((m) => m.id).sort();
    } catch (e) {
      console.error(`[GroqAdapter] Error fetching models: ${e.message}`);
      return ["llama3-8b-8192", "llama3-70b-8192", "mixtral-8x7b-32768"];
    }
  }

  /**
   *
   * @param modelName
   */
  async checkAvailability(modelName) {
    try {
      await this.client.post("/chat/completions", {
        model: modelName,
        messages: [{ role: "user", content: "hi" }],
        max_tokens: 1,
      });
      return true;
    } catch (e) {
      const status = e.response?.status;
      if (status === 404 || status === 400) return false;
      return true;
    }
  }
}

export default GroqAdapter;