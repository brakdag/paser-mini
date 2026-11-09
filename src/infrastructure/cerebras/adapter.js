import axios from "axios";
import DEFAULT_MODELS from "../providerDefaults.js";
import { sendChatCompletion, appendChatMessage, resetChatHistory, normalizeApiError } from "../compatibleChat.js";
import BaseAdapter from "../baseAdapter.js";
import logger from "../../core/logger.js";
import RetryHandler from "../../utils/retryHandler.js";
import { countTokensHeuristic } from "../historyNormalizer.js";

const BASE_URL = "https://api.cerebras.ai/v1";
const DEFAULT_MODEL = DEFAULT_MODELS.CEREBRAS;

/**
 * Static fallback map for model context limits (in tokens).
 * Used when the API does not return the context window size.
 * @type {{[key: string]: number}}
 */
const MODEL_CONTEXT_LIMITS = {
  "llama3.1-8b": 8192,
  "llama3.1-70b": 128000,
};
const DEFAULT_TEMPERATURE = 0.7;
const CHARS_PER_TOKEN = 3.5;

/**
 * Adapter for integrating Cerebras AI models into the system.
 */
class CerebrasAdapter extends BaseAdapter {
  systemInstructionInHistory = true;

  /**
   * Initializes the Cerebras adapter with API client and retry logic.
   * @param {object} params - The constructor parameters.
   * @param {object} params.ui - The UI interface.
   * @param {object} params.configManager - The configuration manager.
   * @param {string} [params.userNickname] - The user's nickname.
   * @param {string} [params.agentNickname] - The agent's nickname.
   */
  constructor({ ui, configManager, userNickname = "user", agentNickname = "assistant" }) {
    super({ ui, configManager, userNickname, agentNickname });
    this.apiKey = process.env.CEREBRAS_API_KEY;
    this.history = [];
    this.currentModel = DEFAULT_MODEL;
    this.systemInstruction = null;
    this.temperature = DEFAULT_TEMPERATURE;

    this.client = axios.create({
      baseURL: BASE_URL,
      timeout: 600000,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
    });

    this.retryHandler = new RetryHandler();
    this.recoverableErrors = ["Empty response from Cerebras"];
    this.maxContextTokens = MODEL_CONTEXT_LIMITS[DEFAULT_MODEL] || 8000;
  }

  /**
   * Fetches and updates the context token limit for the current model.
   * @returns {Promise<void>}
   */
  async _syncContextLimit() {
    try {
      const response = await this.client.get(`/models/${this.currentModel}`);
      const apiLimit = response.data?.context_length || response.data?.max_context_length;
      
      if (apiLimit && typeof apiLimit === 'number') {
        this.maxContextTokens = apiLimit;
        logger.info(`[CerebrasAdapter] Context limit synced via API: ${this.maxContextTokens} tokens for ${this.currentModel}`);
      } else {
        this.maxContextTokens = MODEL_CONTEXT_LIMITS[this.currentModel] || this.maxContextTokens;
        logger.warn(`[CerebrasAdapter] API did not return context limit. Using fallback: ${this.maxContextTokens} tokens for ${this.currentModel}`);
      }
    } catch (error) {
      this.maxContextTokens = MODEL_CONTEXT_LIMITS[this.currentModel] || this.maxContextTokens;
      logger.warn(`[CerebrasAdapter] Failed to sync context limit, using fallback: ${this.maxContextTokens}. Error: ${error.message}`);
    }
  }

  /**
   * Configures the chat session with model, system instruction, and temperature.
   * @param {string} modelName - The model identifier.
   * @param {string} systemInstruction - The system-level prompt.
   * @param {number} [temperature] - The sampling temperature.
   */
  async startChat(modelName, systemInstruction, temperature = DEFAULT_TEMPERATURE) {
    this.currentModel = modelName || this.currentModel;
    this.systemInstruction = systemInstruction;
    this.temperature = temperature;

    // Automatically sync the context limit from the API or fallback
    await this._syncContextLimit();

    this.updateSystemInstruction(this.systemInstruction);
  }

  /**
   * Sends a message to the Cerebras API and returns the response.
   * @param {string} message - The message content to send.
   * @param {string} [role] - The role of the sender.
   * @param {object} [options] - Request cancellation and shared retry budget.
   * @param {AbortSignal} [options.signal] - Cancels requests and waits.
   * @param {import("../../utils/requestBudget.js").default} [options.budget] - Shared request deadline.
   * @returns {Promise<string>} The response text from the API.
   * @throws {Error} If the response is empty or the request fails.
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
   * Injects a message into the conversation history with normalized role and content.
   * @param {string} role - The role of the message sender.
   * @param {string|object|Array} content - The message content.
   * @param {string|null} [timestamp] - The message timestamp.
   */
  injectMessage(role, content, timestamp = null) {
    appendChatMessage(this, role, content, timestamp);
  }

  /**
   * Removes the last message from the conversation history.
   */
  popLastMessage() {
    if (this.history.length > 0) {
      this.history.pop();
    }
  }

  /**
   * Resets the conversation history, optionally applying a new history.
   * @param {Array|null} [historyOverride] - The new history to apply.
   */
  hardReset(historyOverride = null) {
    resetChatHistory(this, historyOverride);
  }

  /**
   * Retrieves the current conversation history.
   * @returns {Array} The conversation history.
   */
  getHistory() {
    return this.history;
  }

  /**
   * Estimates the token count based on character length heuristic.
   * @param {string} systemInstruction - The system instruction text.
   * @param {Array} history - The conversation history.
   * @returns {number} The estimated token count.
   */
  countTokens(systemInstruction, history) {
    return countTokensHeuristic(systemInstruction, history, CHARS_PER_TOKEN);
  }

  /**
   * Fetches the list of available models from the Cerebras API.
   * @returns {Promise<string[]>} A list of available model identifiers.
   */
  async getAvailableModels() {
    try {
      const response = await this.client.get("/models");
      return response.data.data.map((m) => m.id).sort();
    } catch (error) {
      logger.error(`[CerebrasAdapter] Error fetching models: ${error.message}`);
      return ["llama3.1-8b", "llama3.1-70b"];
    }
  }

  /**
   * Checks if a specific model is available and responsive.
   * @param {string} modelName - The model identifier to check.
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
      if (status === 404 || status === 400) {
        return false;
      }
      logger.warn(`[CerebrasAdapter] Model check failed for ${modelName}: ${error.message}`);
      return false;
    }
  }
}

export default CerebrasAdapter;
