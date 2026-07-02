import ConversationState from "../conversationState.js";
import PayloadMapper from "../payloadMapper.js";
import NvidiaRestClient from "./restClient.js";
import logger from "../../core/logger.js";
import BaseAdapter from "../baseAdapter.js";

const DEFAULT_MODEL = "meta/llama-3.1-405b-instruct";
const DEFAULT_TEMPERATURE = 0.7;

/**
 * Adapter for integrating Nvidia AI models into the system.
 */
class NvidiaAdapter extends BaseAdapter {
  /**
   * @param {object} ui - The user interface handler.
   * @param {object} configManager - The system configuration manager.
   * @param {string} userNickname - The identifier for the human user.
   * @param {string} agentNickname - The identifier for the AI agent.
   */
  constructor({
    ui,
    configManager,
    userNickname = "user",
    agentNickname = "assistant",
  }) {
    super({ ui, configManager, userNickname, agentNickname });
    this.state = new ConversationState(userNickname, agentNickname);
    this.restClient = new NvidiaRestClient(configManager);
    this.currentModel = DEFAULT_MODEL;
    this.systemInstruction = "";
    this.temperature = DEFAULT_TEMPERATURE;
    this.lastPayload = null;
  }

  /**
   * Configures the chat session.
   * @param {string} modelName - The specific Nvidia model identifier.
   * @param {string} systemInstruction - The system-level prompt for the model.
   * @param {number} temperature - The sampling temperature for response randomness.
   */
  startChat(modelName, systemInstruction, temperature = DEFAULT_TEMPERATURE) {
    this.currentModel = modelName || this.currentModel;
    this.systemInstruction = systemInstruction;
    this.temperature = temperature;
    logger.info("NvidiaAdapter: Chat started", { model: this.currentModel, temperature });
  }

  /**
   * Sends a message and returns the filtered response.
   * @param {string} message - The text content to be sent.
   * @param {string} role - The role of the message sender.
   * @returns {Promise<string>} The processed response text.
   */
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

  /**
   * Constructs the request payload from current state.
   * @returns {object} The constructed request payload.
   */
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
    return { ...payload, model: this.currentModel };
    
  }

  /**
   * Executes the network request via the REST client.
   * @param {object} payload - The request payload to be sent.
   * @returns {Promise<object>} The raw API response data.
   */
  async _executeRequest(payload) {
    logger.debug("NvidiaAdapter: Sending request", { model: this.currentModel, payload });
    return this.restClient.chatCompletions(payload);
  }

  /**
   * Processes the API response and updates state.
   * @param {object} data - The raw response data from the API.
   * @returns {string} The filtered response content.
   */
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

  /**
   * Standardizes API errors.
   * @param {Error} e - The caught error object.
   * @throws {Error} A standardized APIError.
   */
  _handleError(e) {
    const errorMsg = e.response?.data?.error?.message || e.message;
    logger.error("NvidiaAdapter: Request failed", { error: errorMsg });

    const error = new Error(errorMsg);
    error.name = "APIError";
    throw error;
  }

  /**
   * Removes internal reasoning tags from the model response.
   * @param {string} text - The raw text to be filtered.
   * @returns {string} The cleaned text.
   */
  _filterThoughts(text) {
    if (!text) return "";
    let cleaned = text.replace(/<(thought|reasoning)>[\s\S]*?<\/\1>/gi, "");
    cleaned = cleaned.replace(/^(\[\d{2}:\d{2}:\d{2}\]\s*<[^>]+>\s*)+/g, "");
    return cleaned.trim();
  }

  /**
   * Manually injects a message into the conversation state.
   * @param {string} role - The role of the message sender.
   * @param {string} content - The message content to inject.
   * @param {number|null} timestamp - The optional message timestamp.
   */
  injectMessage(role, content, timestamp = null) {
    this.state.addMessage(role, content, timestamp);
  }

  /**
   * Updates the state rendering mode.
   * @param {string} mode - The rendering mode for the state.
   */
  setRenderingMode(mode) {
    this.state.setRenderingMode(mode);
  }

  /**
   * Resets the conversation state.
   * @param {Array|null} historyOverride - Optional history to apply during reset.
   */
  hardReset(historyOverride = null) {
    this.state.hardReset(historyOverride);
    logger.info("NvidiaAdapter: State hard reset");
  }

  /**
   * Retrieves the raw message history.
   * @returns {Array} The current raw message history.
   */
  getHistory() {
    return this.state.getRawHistory();
  }

  /**
   * Removes the last message from the state.
   */
  popLastMessage() {
    this.state.popLastMessage();
  }

  /**
   * Updates the user and agent nicknames in state.
   * @param {string} userNickname - The new identifier for the human user.
   * @param {string} agentNickname - The new identifier for the AI agent.
   */
  updateNicknames(userNickname, agentNickname) {
    this.state.userNickname = userNickname;
    this.state.agentNickname = agentNickname;
  }

  /**
   * Fetches available models from the Nvidia API.
   * @returns {Promise<string[]>} A list of available model identifiers.
   */
  async getAvailableModels() {
    try {
      const data = await this.restClient.get("models");
      const models = data.data?.map((m) => m.id) || [];
      if (models.length === 0) throw new Error("Empty model list from API");
      logger.info("NvidiaAdapter: Models fetched", { count: models.length });
      return models;
    } catch (e) {
      const errMsg = `[NvidiaAdapter Error] No se pudo obtener la lista de modelos de NVIDIA: ${e.response?.status || ""} - ${e.message}`;
      logger.error(errMsg);
      console.error(errMsg);
      return [];
    }
  }

  /**
   * Checks if a specific model is responsive.
   * @param {string} modelName - The model identifier to check.
   * @returns {Promise<boolean>} True if the model is available or times out, false otherwise.
   */
  async checkAvailability(modelName) {
    try {
      const payload = {
        model: modelName,
        messages: [{ role: "user", content: "hi" }],
        max_tokens: 1,
      };
      await this.restClient.chatCompletions(payload, false, 15000);
      return true;
    } catch (e) {
      if (e.response?.status === 404 || e.response?.data?.detail?.code === 404) {
        logger.warn(`NvidiaAdapter: Model not found (404) - ${modelName}`);
        return false;
      }
      if (e.code === 'ECONNABORTED' || e.message?.toLowerCase().includes('timeout')) {
        logger.warn(`NvidiaAdapter: Model check timed out, assuming available - ${modelName}`);
        return true;
      }
      logger.error(`NvidiaAdapter: Model check failed for ${modelName}`, { error: e.message });
      return false;
    }
  }

  /**
   * Estimates token count based on character length.
   * @param {Array} contents - The list of messages for token estimation.
   * @returns {number} The estimated token count.
   */
  countTokens(systemInstruction, history) {
    const systemChars = systemInstruction?.length || 0;
    const historyChars = history.reduce((acc, msg) => acc + (msg.text?.length || 0), 0);
    // Llama-3 heuristic: ~3.5 characters per token for mixed content
    return Math.ceil((systemChars + historyChars) / 3.5);
  }
}

export default NvidiaAdapter;