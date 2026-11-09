import axios from "axios";
import { sendChatCompletion, appendChatMessage, resetChatHistory, normalizeApiError } from "../compatibleChat.js";
import DEFAULT_MODELS from "../providerDefaults.js";
import BaseAdapter from "../baseAdapter.js";
import logger from "../../core/logger.js";
import RetryHandler from "../../utils/retryHandler.js";
import { countTokensHeuristic } from "../historyNormalizer.js";

const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const BASE_URL = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/ai/v1`;
const DEFAULT_MODEL = DEFAULT_MODELS.CLOUDFLARE;
const DEFAULT_TEMPERATURE = 0.7;
const CHARS_PER_TOKEN = 3.5;

/**
 * Adapter for integrating Cloudflare Workers AI models into the system.
 */
class CloudflareAdapter extends BaseAdapter {
  systemInstructionInHistory = true;

  /**
   * Initializes the Cloudflare adapter with API client and retry logic.
   * @param {object} params - The constructor parameters.
   * @param {object} params.ui - The UI interface.
   * @param {object} params.configManager - The configuration manager.
   * @param {string} [params.userNickname] - The user's nickname.
   * @param {string} [params.agentNickname] - The agent's nickname.
   */
  constructor({ ui, configManager, userNickname = "user", agentNickname = "assistant" }) {
    super({ ui, configManager, userNickname, agentNickname });
    this.apiKey = process.env.CLOUDFLARE_API_KEY;
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
    this.recoverableErrors = ["Empty response from Cloudflare"];
  }

  /**
   * Configures the chat session with model, system instruction, and temperature.
   * @param {string} modelName - The model identifier.
   * @param {string} systemInstruction - The system-level prompt.
   * @param {number} [temperature] - The sampling temperature.
   */
  startChat(modelName, systemInstruction, temperature = DEFAULT_TEMPERATURE) {
    this.currentModel = modelName || this.currentModel;
    this.systemInstruction = systemInstruction;
    this.temperature = temperature;

    this.updateSystemInstruction(this.systemInstruction);
  }

  /**
   * Sends a message to the Cloudflare API and returns the response.
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
   * Fetches the list of available Text Generation models from the native Cloudflare API.
   * @returns {Promise<string[]>} A list of available model identifiers.
   */
  async getAvailableModels() {
    try {
      const nativeUrl = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/ai/models/search`;
      const response = await axios.get(nativeUrl, {
        headers: { Authorization: `Bearer ${this.apiKey}` }
      });

      return response.data.result
        .filter(m => m.task && m.task.name === "Text Generation")
        .map(m => m.name)
        .sort();
    } catch (error) {
      logger.error(`[CloudflareAdapter] Error fetching models: ${error.message}`);
      return [
        "@cf/meta/llama-3.1-8b-instruct",
        "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
        "@cf/meta/llama-3.2-1b-instruct",
        "@cf/meta/llama-3.2-3b-instruct",
        "@cf/qwen/qwq-32b",
        "@cf/deepseek-ai/deepseek-r1-distill-qwen-32b",
      ];
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
      logger.warn(`[CloudflareAdapter] Model check failed for ${modelName}: ${error.message}`);
      return false;
    }
  }
}

export default CloudflareAdapter;
