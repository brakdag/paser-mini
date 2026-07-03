import axios from "axios";
import BaseAdapter from "../baseAdapter.js";
import logger from "../../core/logger.js";
import IRCFormatter from "../../utils/ircFormatter.js";
import RetryHandler from "../../utils/retryHandler.js";

/**
 * Adapter for the Cohere AI API, providing chat capabilities and history management.
 * @augments BaseAdapter
 */
class CohereAdapter extends BaseAdapter {
  /**
   * @param {object} ui - The UI interface for displaying information.
   * @param {object} configManager - The configuration manager.
   * @param {string} [userNickname] - The nickname of the user.
   * @param {string} [agentNickname] - The nickname of the agent.
   */
  constructor(ui, configManager, userNickname = "user", agentNickname = "assistant") {
    super(ui, configManager, userNickname, agentNickname);
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

    const lastMessage = this.history.pop();
    const payload = this._preparePayload(lastMessage);
    this.history.push(lastMessage);

    /**
     * Executes the API request with retry logic.
     * @returns {Promise<string>} The response text.
     */
    return this.retryHandler.execute(async () => {
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
       * @param {number} attempt - The current attempt number.
       * @param {Error} error - The error that triggered the retry.
       * @param {string} formattedDelay - The formatted delay string.
       */
      onRetry: (attempt, error, formattedDelay) => {
        logger.warn(`[CohereAdapter] Retrying in ${formattedDelay}... (${attempt}/15) due to: ${error.message}`);
        if (this.ui && this.ui.displayInfo) {
          this.ui.displayInfo(`Reintentando Cohere en ${formattedDelay}... (${attempt}/15) | Error: ${error.message}`);
        }
      }
    });
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
        message: msg.content
      }));

    return {
      model: this.currentModel,
      message: lastMessage.content,
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
    const apiRole = this._normalizeRole(role);
    const finalContent = this._normalizeContent(content, apiRole);

    this.history.push({
      role: apiRole,
      content: finalContent,
      timestamp: timestamp || IRCFormatter.getTimestamp(),
    });
  }

  /**
   * Maps internal roles to Cohere API roles.
   * @param {string} role - The internal role name.
   * @private
   * @returns {string} The normalized API role.
   */
  _normalizeRole(role) {
    if (role === this.userNickname) return "user";
    if (role === this.agentNickname) return "assistant";
    if (role === "server") return "user";
    return role;
  }

  /**
   * Sanitizes and formats message content based on type and role.
   * @param {string|object|Array} content - The raw content.
   * @param {string} role - The normalized API role.
   * @private
   * @returns {string} The formatted string content.
   */
  _normalizeContent(content, role) {
    let finalContent = content;
    if (content && typeof content === 'object' && content.mime_type && content.data) {
      finalContent = `[Image Data: ${content.mime_type}]`;
    } else if (Array.isArray(content)) {
      finalContent = content.join("\n");
    }

    if (typeof finalContent === 'string' && role === 'assistant') {
      finalContent = finalContent.replace(/<thought>[\s\S]*?<\/thought>/gi, '').trim();
    }
    return finalContent;
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
