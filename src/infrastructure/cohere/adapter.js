import axios from "axios";
import axiosRetry from "axios-retry";
import BaseAdapter from "../baseAdapter.js";
import logger from "../../core/logger.js";
import IRCFormatter from "../../utils/ircFormatter.js";

class CohereAdapter extends BaseAdapter {
  constructor(ui, configManager, userNickname = "user", agentNickname = "assistant") {
    super(ui, configManager, userNickname, agentNickname);
    this.apiKey = process.env.COHERE_API_KEY;
    this.history = [];
    this.currentModel = "command-r-plus";
    this.systemInstruction = null;
    this.temperature = 0.7;

    this.client = axios.create({
      baseURL: "https://api.cohere.com/v1",
      timeout: 600000,
      headers: {
        "Authorization": `Bearer ${this.apiKey}`,
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
        const time = IRCFormatter.getTimestamp();
        const msg = `[${time}] -!- [CohereAdapter] API Retry ${retryCount}/5 due to: ${error.response?.status || error.message}`;
        logger.warn(msg);
        if (this.ui && this.ui.displayInfo) {
          this.ui.displayInfo(`Reintentando Cohere... (${retryCount}/5) | Error: ${error.response?.status || error.message}`);
        }
      },
    });
  }

  startChat(modelName, systemInstruction, temperature = 0.7) {
    this.currentModel = modelName || this.currentModel;
    this.systemInstruction = systemInstruction;
    this.temperature = temperature;
    // Cohere uses 'preamble' instead of a system message in history
  }

  async sendMessage(message, role = "user") {
    const timestamp = IRCFormatter.getTimestamp();
    this.injectMessage(role, message, timestamp);

    // Cohere expects the last message separately from the history
    const lastMessage = this.history.pop();
    
    // Map history to Cohere format: { role: 'USER' | 'CHATBOT', message: string }
    const chatHistory = this.history
      .filter(msg => msg.role !== 'system')
      .map(msg => ({
        role: msg.role === 'user' ? 'USER' : 'CHATBOT',
        message: msg.content
      }));

    const payload = {
      model: this.currentModel,
      message: lastMessage.content,
      chat_history: chatHistory,
      preamble: this.systemInstruction,
      temperature: this.temperature,
    };

    // Restore last message to history for consistency
    this.history.push(lastMessage);

    try {
      const response = await this.client.post("/chat", payload);
      const textContent = response.data.text;

      if (textContent) {
        const msgTimestamp = IRCFormatter.getTimestamp();
        this.injectMessage("assistant", textContent, msgTimestamp);
        return textContent;
      }

      throw new Error("Empty response from Cohere");
    } catch (e) {
      const errorMsg = e.response?.data?.error?.message || e.message;
      const error = new Error(errorMsg);
      error.name = "APIError";
      throw error;
    }
  }

  injectMessage(role, content, timestamp = null) {
    let apiRole = role;
    if (role === this.userNickname) apiRole = "user";
    if (role === this.agentNickname) apiRole = "assistant";
    if (role === "server") apiRole = "user";

    let finalContent = content;
    if (content && typeof content === 'object' && content.mime_type && content.data) {
      finalContent = `[Image Data: ${content.mime_type}]`;
    } else if (Array.isArray(content)) {
      finalContent = content.join("\n");
    }

    if (typeof finalContent === 'string' && apiRole === 'assistant') {
      finalContent = finalContent.replace(/<thought>[\s\S]*?<\/thought>/gi, '').trim();
    }

    this.history.push({
      role: apiRole,
      content: finalContent,
      timestamp: timestamp || IRCFormatter.getTimestamp(),
    });
  }

  popLastMessage() {
    if (this.history.length > 0) {
      this.history.pop();
    }
  }

  hardReset(historyOverride = null) {
    this.history = historyOverride || [];
    logger.info("[CohereAdapter] History hard reset");
  }

  getHistory() {
    return this.history;
  }

  async getAvailableModels() {
    return ["command-r-plus", "command-r"];
  }
}

export default CohereAdapter;