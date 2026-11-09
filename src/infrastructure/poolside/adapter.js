import axios from "axios";
import DEFAULT_MODELS from "../providerDefaults.js";
import { sendChatCompletion, appendChatMessage, resetChatHistory, normalizeApiError } from "../compatibleChat.js";
import BaseAdapter from "../baseAdapter.js";
import logger from "../../core/logger.js";
import RetryHandler from "../../utils/retryHandler.js";

const BASE_URL = "https://inference.poolside.ai/v1";
const DEFAULT_MODEL = DEFAULT_MODELS.POOLSIDE;
const DEFAULT_TEMPERATURE = 0.7;
const REQUEST_TIMEOUT_MS = 10 * 60 * 1000;
const FALLBACK_MODELS = ["poolside/laguna-s-2.1", "poolside/laguna-xs-2.1"];

/**
 * Adapter for the Poolside AI API, providing chat capabilities and history management.
 * @augments BaseAdapter
 */
class PoolsideAdapter extends BaseAdapter {
  systemInstructionInHistory = true;

  /**
   * @param {object} params - The constructor parameters.
   * @param {object} params.ui - The UI interface.
   * @param {object} params.configManager - The configuration manager.
   * @param {string} [params.userNickname] - The user's nickname.
   * @param {string} [params.agentNickname] - The agent's nickname.
   */
  constructor({ ui, configManager, userNickname = "user", agentNickname = "assistant" }) {
    super({ ui, configManager, userNickname, agentNickname });
    this.apiKey = process.env.POOLSIDE_API_KEY;
    this.history = [];
    this.currentModel = DEFAULT_MODEL;
    this.systemInstruction = null;
    this.temperature = DEFAULT_TEMPERATURE;
    this.lastRequestTime = 0;

    this._configureClient();
    this.retryHandler = new RetryHandler();
    this.recoverableErrors = ["Empty response from Poolside"];
  }

  /**
   * @private
   */
  _configureClient() {
    this.client = axios.create({
      baseURL: BASE_URL,
      timeout: REQUEST_TIMEOUT_MS,
      headers: {
        "Authorization": `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
    });
  }

  /**
   * Initializes or updates the chat session parameters.
   * @param {string} modelName - The name of the model to use.
   * @param {string} systemInstruction - The system prompt/preamble.
   * @param {number} [temperature] - The sampling temperature.
   */
  startChat(modelName, systemInstruction, temperature = DEFAULT_TEMPERATURE) {
    this.currentModel = modelName || this.currentModel;
    this.systemInstruction = systemInstruction;
    this.temperature = temperature;
    this._updateSystemInstruction();
  }

  /**
   * Sends a message to the Poolside API and returns the response text.
   * @param {string|object|Array} message - The message content to send.
   * @param {string} [role] - The role of the sender.
   * @param {object} [options] - Request cancellation and shared retry budget.
   * @param {AbortSignal} [options.signal] - Cancels requests and waits.
   * @param {import("../../utils/requestBudget.js").default} [options.budget] - Shared request deadline.
   * @returns {Promise<string>} The response text from the AI.
   * @throws {Error} If the API request fails.
   */
  async _sendMessage(message, role = "user", { signal, budget } = {}) {
    return sendChatCompletion(this, message, role, { signal, budget });
  }

  /**
   * Normalizes and injects a message into the chat history.
   * @param {string} role - The role of the message sender.
   * @param {string|object|Array} content - The content of the message.
   * @param {string|null} [timestamp] - The timestamp of the message.
   */
  injectMessage(role, content, timestamp = null) {
    appendChatMessage(this, role, content, timestamp);
  }

  /**
   * Removes the last message from the chat history.
   */
  popLastMessage() {
    if (this.history.length > 0) {
      this.history.pop();
    }
  }

  /**
   * Resets the chat history, optionally with a new history array.
   * @param {Array|null} [historyOverride] - The new history to set.
   */
  hardReset(historyOverride = null) {
    resetChatHistory(this, historyOverride);
  }

  /**
   * Retrieves the current chat history.
   * @returns {Array} The history array.
   */
  getHistory() {
    return this.history;
  }

  /**
   * Fetches the list of available models from the Poolside API.
   * @returns {Promise<string[]>} A list of model names.
   */
  async getAvailableModels() {
    try {
      const response = await this.client.get("/models");
      return response.data.data.map((m) => m.id).sort();
    } catch (error) {
      logger.error(`[PoolsideAdapter] Error fetching models: ${error.message}`);
      if (this.ui && this.ui.displayInfo) {
        this.ui.displayInfo(`Could not fetch Poolside models (${error.message}). Using fallback list.`);
      }
      return [...FALLBACK_MODELS];
    }
  }

  /**
   * Checks if a specific model is available and responding.
   * @param {string} modelName - The name of the model to check.
   * @returns {Promise<boolean>} True if available, false otherwise.
   */
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
      throw error;
    }
  }

  /**
   * Replaces or inserts the system instruction at the head of the history.
   * @private
   * @returns {void}
   */
  _updateSystemInstruction() {
    this.updateSystemInstruction(this.systemInstruction);
  }

  /**
   * Normalizes an API error into a standardized Error object with the APIError name.
   * @private
   * @param {Error} error - The caught error object.
   * @returns {Error} A formatted Error object with name "APIError".
   */
  _handleApiError(error) {
    return normalizeApiError(error);
  }
}

export default PoolsideAdapter;
