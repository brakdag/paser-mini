import axios from "axios";
import BaseAdapter from "../baseAdapter.js";
import logger from "../../core/logger.js";
import IRCFormatter from "../../utils/ircFormatter.js";
import RetryHandler from "../../utils/retryHandler.js";
import { normalizeRole, normalizeContent } from "../historyNormalizer.js";

/**
 * Adapter for the Cohere AI API, providing chat capabilities and history management.
 * @augments BaseAdapter
 */
class CohereAdapter extends BaseAdapter {
  /**
   * @param {object} params - The constructor parameters.
   * @param {object} params.ui - The UI interface.
   * @param {object} params.configManager - The configuration manager.
   * @param {string} [params.userNickname] - The user's nickname.
   * @param {string} [params.agentNickname] - The agent's nickname.
   */
  constructor({ ui, configManager, userNickname = "user", agentNickname = "assistant" }) {
    super({ ui, configManager, userNickname, agentNickname });
    this.apiKey = process.env.COHERE_API_KEY;
    this.history = [];
    this.currentModel = "command-r-plus";
    this.systemInstruction = null;
    this.temperature = 0.7;

    this._configureClient();
    this.retryHandler = new RetryHandler();
    this.recoverableErrors = ["Empty response from Cohere"];
  }

  /**
   * Configures the axios client with base URL, timeout, and headers.
   * @private
   */
  _configureClient() {
    this.client = axios.create({
      baseURL: "https://api.cohere.com/v1",
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
    this.systemInstruction = systemInstruction;
    this.temperature = temperature;
    logger.info(`[CohereAdapter] startChat received systemInstruction. Length: ${systemInstruction?.length || 0} chars`);
  }

  /**
   * Sends a message to the Cohere API and returns the response text.
   * @param {string|object|Array} message - The message content to send.
   * @param {string} [role] - The role of the sender.
   * @returns {Promise<string>} The response text from the AI.
   * @throws {Error} If the API request fails.
   */
  async sendMessage(message, role = "user") {
    const timestamp = IRCFormatter.getTimestamp();
    this.injectMessage(role, message, timestamp);
    this._enforceContextLimit();
    const historyLengthBefore = this.history.length;

    const lastMessage = this.history.pop();
    const payload = this._preparePayload(lastMessage);

    await this._applyRateLimit();
    this.history.push(lastMessage);

    try {
      return await this.retryHandler.execute(async () => {
        try {
          logger.info(`[CohereAdapter] Requesting: ${this.client.defaults.baseURL}/chat`);
          logger.info(`[CohereAdapter] Payload: ${JSON.stringify(payload)}`);

          const response = await this.client.post("/chat", payload);
          return this._handleResponse(response);
        } catch (error) {
          throw this._handleApiError(error);
        }
      }, {
        recoverableErrors: this.recoverableErrors,
        /**
         * Callback executed when a retry is attempted.
         * @param {number} attempt - The current attempt number.
         * @param {Error} error - The error that triggered the retry.
         * @param {string} formattedDelay - The formatted delay string.
         * @returns {void}
         */
        onRetry: (attempt, error, formattedDelay) => {
          logger.warn(`[CohereAdapter] Retrying in ${formattedDelay}... (${attempt}/15) due to: ${error.message}`);
          if (this.ui && this.ui.displayInfo) {
            this.ui.displayInfo(`Retrying Cohere in ${formattedDelay}... (${attempt}/15) | Error: ${error.message}`);
          }
        }
      });
    } catch (error) {
      if (this.history.length === historyLengthBefore) {
        this.popLastMessage();
      }
      throw error;
    }
  }

  /**
   * Prepares the payload for the Cohere /chat endpoint.
   * @param {object} lastMessage - The most recent message in the history.
   * @private
   * @returns {object} The formatted payload.
   */
  _preparePayload(lastMessage) {
    const chatHistory = this.history
      .filter(msg => msg.role !== 'system')
      .map(msg => ({
        role: msg.role === 'user' ? 'USER' : 'CHATBOT',
        message: this.formatTextForPayload(msg.role, msg.content, msg.timestamp)
      }));

    return {
      model: this.currentModel,
      message: this.formatTextForPayload(lastMessage.role, lastMessage.content, lastMessage.timestamp),
      chat_history: chatHistory,
      preamble: this.systemInstruction,
      temperature: this.temperature,
      stream: false,
    };
  }

  /**
   * Processes the API response and injects the assistant's message into history.
   * @param {object} response - The axios response object.
   * @private
   * @returns {string} The extracted text content.
   * @throws {Error} If the response text is empty.
   */
  _handleResponse(response) {
    const textContent = response.data.text;

    if (textContent) {
      const msgTimestamp = IRCFormatter.getTimestamp();
      this.injectMessage("assistant", textContent, msgTimestamp);
      return textContent;
    }

    throw new Error("Empty response from Cohere");
  }

  /**
   * Formats an API error into a standardized Error object.
   * @param {Error} error - The caught error object.
   * @private
   * @returns {Error} A formatted Error object with name "APIError".
   */
  _handleApiError(error) {
    const errorMsg = error.response?.data?.error?.message || error.message;
    const apiError = new Error(errorMsg);
    apiError.name = "APIError";
    return apiError;
  }

  /**
   * Normalizes and injects a message into the chat history.
   * @param {string} role - The role of the message sender.
   * @param {string|object|Array} content - The content of the message.
   * @param {string|null} [timestamp] - The timestamp of the message.
   */
  injectMessage(role, content, timestamp = null) {
    const apiRole = normalizeRole(role, this.user.nickname, this.model.nickname);
    const finalContent = normalizeContent(content, apiRole);

    this.history.push({
      role: apiRole,
      content: finalContent,
      timestamp: timestamp || IRCFormatter.getTimestamp(),
    });
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
    this.history = historyOverride || [];
    logger.info("[CohereAdapter] History hard reset");
  }

  /**
   * Retrieves the current chat history.
   * @returns {Array} The history array.
   */
  getHistory() {
    return this.history;
  }

  /**
   * Fetches the list of available models from the Cohere API.
   * @returns {Promise<string[]>} A list of model names.
   */
  async getAvailableModels() {
    try {
      const response = await this.client.get("/models");
      return response.data.models.map((m) => m.name);
    } catch (error) {
      logger.error(`[CohereAdapter] Error fetching models: ${error.message}`);
      return ["command-r-plus", "command-r"];
    }
  }

  /**
   * Checks if a specific model is available and responding.
   * @param {string} modelName - The name of the model to check.
   * @returns {Promise<boolean>} True if available, false otherwise.
   */
  async checkAvailability(modelName) {
    try {
      await this.client.post("/chat", {
        model: modelName,
        message: "hi",
        max_tokens: 1,
      });
      return true;
    } catch (error) {
      const status = error.response?.status;
      if (status === 404 || status === 400) return false;
      return true;
    }
  }
}

export default CohereAdapter;
