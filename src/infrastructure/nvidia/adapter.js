import ConversationState from "../conversationState.js";
import PayloadMapper from "../payloadMapper.js";
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
    logger.info("NvidiaAdapter: Chat started", { model: this.currentModel, temperature });
  }

  async sendMessage(message, role = "user") {
    this.state.addMessage(role, message);

    const payload = this._preparePayload();
    this.lastPayload = payload;

    try {
      const data = await this._executeRequest(payload);
      return this._handleResponse(data);
    } catch (e) {
      return this._handleError(e);
    }
  }

  _preparePayload() {
    const history = this.state.getRawHistory();
    const processedHistory = history.map((m) => ({
      ...m,
      text: typeof m.text === 'string' ? m.text : JSON.stringify(m.text),
    }));

    const payload = PayloadMapper.toNvidia(
      processedHistory,
      this.systemInstruction,
      this.temperature,
    );
    payload.model = this.currentModel;
    return payload;
  }

  async _executeRequest(payload) {
    logger.debug("NvidiaAdapter: Sending request", { model: this.currentModel, payload });
    return await this.restClient.chatCompletions(payload);
  }

  _handleResponse(data) {
    const rawContent = data.choices?.[0]?.message?.content || "";
    const content = this._filterThoughts(rawContent);

    if (!content) {
      logger.warn("NvidiaAdapter: Empty response received");
      return "Error: Empty response from NVIDIA";
    }

    logger.info("NvidiaAdapter: Response received", { length: content.length });
    this.state.addMessage("model", content);
    return content;
  }

  _handleError(e) {
    const errorMsg = e.response?.data?.error?.message || e.message;
    logger.error("NvidiaAdapter: Request failed", { error: errorMsg });

    const error = new Error(errorMsg);
    error.name = "APIError";
    throw error;
  }

  _filterThoughts(text) {
    if (!text) return "";
    let cleaned = text.replace(/<(thought|reasoning)>[\s\S]*?<\/\1>/gi, "");
    cleaned = cleaned.replace(/^(\[\d{2}:\d{2}:\d{2}\]\s*<[^>]+>\s*)+/g, "");
    return cleaned.trim();
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
      logger.error("NvidiaAdapter: Error fetching models", { error: e.message });
      return [];
    }
  }

  async checkAvailability(modelName) {
    try {
      const payload = {
        model: modelName,
        messages: [{ role: "user", content: "hi" }],
        max_tokens: 1,
      };
      await this.restClient.chatCompletions(payload, false, 1000);
      return true;
    } catch (e) {
      if (e.code === 'ECONNABORTED' || e.message?.toLowerCase().includes('timeout')) {
        return true;
      }
      return e.response?.status !== 404 ? false : false;
    }
  }

  countTokens(contents) {
    const totalChars = contents.reduce((acc, msg) => acc + (msg.text?.length || 0), 0);
    return Math.floor(totalChars / 4);
  }
}

export default NvidiaAdapter;