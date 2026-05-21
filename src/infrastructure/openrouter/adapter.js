import axios from "axios";
import axiosRetry from "axios-retry";
import BaseAdapter from "../baseAdapter.js";
import logger from "../../core/logger.js";

class OpenRouterAdapter extends BaseAdapter {
  constructor(ui, configManager, userNickname = "user", agentNickname = "assistant") {
    super(ui, configManager, userNickname, agentNickname);
    this.apiKey = process.env.OPENROUTER_API_KEY;
    this.history = [];
    this.currentModel = "openai/gpt-3.5-turbo";
    this.systemInstruction = null;
    this.temperature = 0.7;

    this.client = axios.create({
      baseURL: "https://openrouter.ai/api/v1",
      timeout: 600000,
      headers: {
        "Authorization": `Bearer ${this.apiKey}`,
        "HTTP-Referer": "https://paser-mini.local",
        "X-Title": "Paser Mini",
        "Content-Type": "application/json",
      },
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
        const time = new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
        const msg = `[${time}] -!- [OpenRouterAdapter] API Retry ${retryCount}/5 due to: ${error.response?.status || error.message}`;
        logger.warn(msg);
        if (this.ui && this.ui.displayInfo) {
          this.ui.displayInfo(`Reintentando OpenRouter... (${retryCount}/5) | Error: ${error.response?.status || error.message}`);
        }
      },
    });
  }

  startChat(modelName, systemInstruction, temperature = 0.7) {
    this.currentModel = modelName || this.currentModel;
    this.systemInstruction = systemInstruction;
    this.temperature = temperature;
    if (this.history.length === 0 && this.systemInstruction) {
      this.injectMessage("system", this.systemInstruction);
    }
  }

  async sendMessage(message, role = "user") {
    const timestamp = new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
    
    this.injectMessage(role, message, timestamp);

    const payload = {
      model: this.currentModel,
      messages: this.history,
      temperature: this.temperature,
    };

    try {
      const response = await this.client.post("/chat/completions", payload);
      const textContent = response.data.choices[0].message.content;

      if (textContent) {
        const msgTimestamp = new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
        this.injectMessage("assistant", textContent, msgTimestamp);
        return textContent;
      }

      throw new Error("Empty response from OpenRouter");
    } catch (e) {
      const errorMsg = e.response?.data?.error?.message || e.message;
      const error = new Error(errorMsg);
      error.name = "APIError";
      throw error;
    }
  }

  injectMessage(role, content, timestamp = null) {
    // Map internal roles to OpenRouter/OpenAI roles
    let apiRole = role;
    if (role === this.userNickname) apiRole = "user";
    if (role === this.agentNickname) apiRole = "assistant";
    if (role === "server") apiRole = "user";

    let finalContent = content;
    if (content && typeof content === 'object' && content.mime_type && content.data) {
      finalContent = [
        { type: "text", text: `Image resolution: ${content.resolution || 'unknown'}` },
        { type: "image_url", image_url: { url: `data:${content.mime_type};base64,${content.data}` } }
      ];
    }

    this.history.push({
      role: apiRole,
      content: finalContent,
      timestamp: timestamp || new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }),
    });
  }

  popLastMessage() {
    if (this.history.length > 0) {
      this.history.pop();
    }
  }

  getHistory() {
    return this.history;
  }

  async getAvailableModels() {
    try {
      const response = await this.client.get("/models");
      return response.data.data.map((m) => m.id);
    } catch (e) {
      console.error(`[OpenRouterAdapter] Error fetching models: ${e.message}`);
      return ["openai/gpt-3.5-turbo", "anthropic/claude-3-opus"];
    }
  }
}

export default OpenRouterAdapter;