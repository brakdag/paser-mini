import axios from "axios";
import { sendChatCompletion, appendChatMessage, resetChatHistory, normalizeApiError } from "../compatibleChat.js";
import DEFAULT_MODELS from "../providerDefaults.js";
import BaseAdapter from "../baseAdapter.js";
import logger from "../../core/logger.js";
import RetryHandler from "../../utils/retryHandler.js";

const BASE_URL = "https://router.huggingface.co/v1";

/**
 * Adapter for the HuggingFace API, providing chat capabilities and history management.
 * @augments BaseAdapter
 */
class HuggingFaceAdapter extends BaseAdapter {
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
    this.apiKey = process.env.HUGGINGFACE_API_KEY;
    this.history = [];
    this.currentModel = DEFAULT_MODELS.HUGGINGFACE;
    this.systemInstruction = null;
    this.temperature = 0.7;

    this._configureClient();
    this.retryHandler = new RetryHandler();
    this.recoverableErrors = ["Empty response from HuggingFace"];
  }

  /**
   * Configures the axios client with base URL, timeout, and headers.
   * @private
   */
  _configureClient() {
    this.client = axios.create({
      baseURL: BASE_URL,
      timeout: 600000,
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
  startChat(modelName, systemInstruction, temperature = 0.7) {
    this.currentModel = modelName || this.currentModel;
    this.temperature = temperature;
    this.updateSystemInstruction(systemInstruction);
  }

  /**
   * Sends a message to the HuggingFace API and returns the response text.
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
   * Formats an API error into a standardized Error object.
   * @param {Error} error - The caught error object.
   * @private
   * @returns {Error} A formatted Error object with name "APIError".
   */
  _handleApiError(error) {
    return normalizeApiError(error);
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
   * Fetches the list of available models from the HuggingFace API.
   * @returns {Promise<string[]>} A list of model names.
   */
  async getAvailableModels() {
    try {
      const response = await this.client.get("/models");
      return response.data.data.map((m) => m.id);
    } catch (error) {
      logger.error(`[HuggingFaceAdapter] Error fetching models: ${error.message}`);
      return ["meta-llama/Meta-Llama-3-8B-Instruct", "mistralai/Mistral-7B-Instruct-v0.2"];
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
      logger.warn(
        `[HuggingFaceAdapter] Availability check inconclusive for ${modelName} (HTTP ${status || "unknown"}): ${error.message}. Assuming available.`,
      );
      return true;
    }
  }
}

export default HuggingFaceAdapter;