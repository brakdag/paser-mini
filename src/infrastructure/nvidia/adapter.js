import ConversationState from "../conversationState.js";
import { PayloadMapper } from "../payloadMapper.js";
import NvidiaRestClient from "./restClient.js";
import logger from "../../core/logger.js";
import BaseAdapter from "../baseAdapter.js";

class NvidiaAdapter extends BaseAdapter {
  constructor(
    ui,
    configManager,
    userNickname = "user",
    agentNickname = "assistant",
  ) {
    super(ui, configManager, userNickname, agentNickname);
    this.state = new ConversationState(userNickname, agentNickname);
    this.restClient = new NvidiaRestClient(configManager);
    this.currentModel = "meta/llama-3.1-405b-instruct";
    this.systemInstruction = "";
    this.temperature = 0.7;
    this.lastPayload = null;
  }

  startChat(modelName, systemInstruction, temperature = 0.7) {
    this.currentModel = modelName || this.currentModel;
    this.systemInstruction = systemInstruction;
    this.temperature = temperature;
    logger.info("NvidiaAdapter: Chat started", {
      model: this.currentModel,
      temperature,
    });
  }

  _filterThoughts(text) {
    if (!text) return "";
    let cleaned = text.replace(/<(thought|reasoning)>[\s\S]*?<\/\1>/gi, "");
    cleaned = cleaned.replace(/^(\[\d{2}:\d{2}:\d{2}\]\s*<[^>]+>\s*)+/g, "");
    return cleaned.trim();
  }

  async sendMessage(message, role = "user") {
    this.state.addMessage(role, message);

    const history = this.state.getRawHistory();
    let processedHistory;

    if (this.state.renderingMode === "CLEAN") {
      processedHistory = history.map((m) => ({
        ...m,
        text: m.text
          .replace(/^(\[\d{2}:\d{2}:\d{2}\]\s*<[^>]+>\s*)+/g, "")
          .trim(),
      }));
    } else if (this.state.renderingMode === "IRC") {
      processedHistory = history.map((m) => ({
        ...m,
        text: this.state._formatMessage(m.role, m.text, m.timestamp),
      }));
    } else {
      processedHistory = history;
    }

    const payload = PayloadMapper.toNvidia(
      processedHistory,
      this.systemInstruction,
      this.temperature,
    );
    payload.model = this.currentModel;
    // payload.max_tokens removed to prevent truncated responses
    this.lastPayload = payload;

    try {
      logger.debug("NvidiaAdapter: Sending request", {
        model: this.currentModel,
        payload,
      });
      const data = await this.restClient.chatCompletions(payload);
      const rawContent = data.choices?.[0]?.message?.content || "";
      const content = this._filterThoughts(rawContent);

      if (content) {
        logger.info("NvidiaAdapter: Response received", {
          length: content.length,
        });
        this.state.addMessage("model", content);
        return content;
      }
      logger.warn("NvidiaAdapter: Empty response received");
      return "Error: Empty response from NVIDIA";
    } catch (e) {
      const errorMsg = e.response?.data?.error?.message || e.message;
      logger.error("NvidiaAdapter: Request failed", { error: errorMsg });

      const error = new Error(errorMsg);
      error.name = "APIError";
      throw error;
    }
  }

  injectMessage(role, content, timestamp = null) {
    this.state.addMessage(role, content, timestamp);
  }

  setRenderingMode(mode) {
    this.state.setRenderingMode(mode);
  }

  hardReset(historyOverride = null) {
    this.state.hardReset(historyOverride);
    logger.info("NvidiaAdapter: State hard reset");
  }

  getHistory() {
    return this.state.getRawHistory();
  }

  popLastMessage() {
    this.state.popLastMessage();
  }

  updateNicknames(userNickname, agentNickname) {
    this.state.userNickname = userNickname;
    this.state.agentNickname = agentNickname;
  }

  async getAvailableModels() {
    try {
      const data = await this.restClient.get("models");
      const models = data.data?.map((m) => m.id) || [];
      logger.info("NvidiaAdapter: Models fetched", { count: models.length });
      return models;
    } catch (e) {
      logger.error("NvidiaAdapter: Error fetching models", {
        error: e.message,
      });
      return ["models/gemini-2.0-flash", "models/gemini-1.5-flash"];
    }
  }

  async checkAvailability(modelName) {
    try {
      const payload = {
        model: modelName,
        messages: [{ role: "user", content: "hi" }],
        max_tokens: 1,
      };

      await this.restClient.chatCompletions(payload);
      return true;
    } catch (e) {
      if (e.response && e.response.status === 404) {
        return false;
      }
      return true;
    }
  }

  countTokens(contents) {
    const totalChars = contents.reduce(
      (acc, msg) => acc + (msg.text?.length || 0),
      0,
    );
    return Math.floor(totalChars / 4);
  }

  async close() {
    // No resources to clean up for NvidiaAdapter
  }
}

export default NvidiaAdapter;

