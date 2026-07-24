import axios from "axios";
import BaseAdapter from "../baseAdapter.js";
import logger from "../../core/logger.js";
import IRCFormatter from "../../utils/ircFormatter.js";
import RetryHandler from "../../utils/retryHandler.js";
import { normalizeRole, normalizeContent } from "../historyNormalizer.js";

const BASE_URL = "https://api.cohere.com/v2";
const SCHWA = String.fromCharCode(399); // Uso el codigo Unicode para evitar que el parser local colapse

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
    this.lastPayload = null;
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

    const payload = this._preparePayload();

    await this._applyRateLimit();

    try {
      return await this.retryHandler.execute(async () => {
        try {
          this.lastPayload = payload;
          logger.info(`[CohereAdapter] Requesting: ${this.client.defaults.baseURL}/v2/chat`);
          logger.info(`[CohereAdapter] Payload: ${JSON.stringify(payload)}`);

          const response = await this.client.post("/chat", payload);
          return this._handleResponse(response);
        } catch (error) {
          throw this._handleApiError(error, payload);
        }
      }, {
        recoverableErrors: this.recoverableErrors,
        /**
         * Handles retry attempts by logging and displaying information.
         * @param {number} attempt - The current retry attempt number.
         * @param {Error} error - The error that triggered the retry.
         * @param {string} formattedDelay - The formatted delay string for display.
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
   * @private
   * @returns {object} The formatted payload.
   */
  _preparePayload() {
    const messages = [];

    if (this.systemInstruction) {
      // Purga absoluta del token nativo en el system prompt para evitar que Cohere arroje 422
      const cleanInstruction = this.systemInstruction.split(SCHWA).join('execute:');
      messages.push({
        role: 'system',
        content: cleanInstruction
      });
    }

    const mappedHistory = this.history
      .filter(msg => msg.content && String(msg.content).trim())
      .map(msg => ({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: this.formatTextForPayload(msg.role, msg.content, msg.timestamp)
      }));

    const { sanitizedHistory } = mappedHistory.reduce((acc, msg) => {
      if (msg.role === acc.expectedRole) {
        acc.sanitizedHistory.push(msg);
        acc.expectedRole = acc.expectedRole === 'user' ? 'assistant' : 'user';
      } else {
        const lastMsg = acc.sanitizedHistory[acc.sanitizedHistory.length - 1];
        if (lastMsg) {
          lastMsg.content += `\n${msg.content}`;
        } else {
          acc.sanitizedHistory.push(msg);
          acc.expectedRole = 'user';
        }
      }
      return acc;
    }, { sanitizedHistory: [], expectedRole: 'user' });

    const finalMessages = [...messages, ...sanitizedHistory];

    return {
      model: this.currentModel,
      messages: finalMessages,
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
    const message = response.data?.message;
    let textContent = '';
    let toolCallText = '';
    
    if (Array.isArray(message?.content) && message?.content.length > 0) {
      textContent = message.content.map(part => part.text || '').join('\n');
    }

    if (Array.isArray(message?.tool_calls) && message.tool_calls.length > 0) {
      const toolNames = message.tool_calls.map(call => {
        try {
          const args = typeof call.function.arguments === 'string' ? JSON.parse(call.function.arguments) : call.function.arguments;
          return `${call.function.name}(${JSON.stringify(args)})`;
        } catch {
          return `${call.function.name}(${call.function.arguments || ''})`;
        }
      });
      toolCallText = `[TOOL_EXEC] ${toolNames.join('\n[TOOL_EXEC] ')}`;
    }

    const finalText = `${textContent}${textContent && toolCallText ? '\n' : ''}${toolCallText}`.trim();

    if (finalText) {
      const msgTimestamp = IRCFormatter.getTimestamp();
      this.injectMessage("assistant", finalText, msgTimestamp);
      return finalText;
    }

    throw new Error("Empty response from Cohere");
  }

  /**
   * Formats an API error into a standardized Error object.
   * @param {Error} error - The caught error object.
   * @param {object} payload - The payload sent to the API when the error occurred.
   * @private
   * @returns {Error} A formatted Error object with name "APIError".
   */
  _handleApiError(error, payload) {
    const errorData = error.response?.data;
    const errorMsg = errorData?.message || error.message;
    const apiError = new Error(errorMsg);
    apiError.name = "APIError";
    apiError.status = error.response?.status;
    apiError.code = error.code;
    apiError.payload = payload;
    apiError.response = error.response;
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
    const lastMessage = this.history[this.history.length - 1];

    const safeRole = apiRole === 'assistant' ? 'assistant' : 'user';
    let safeContent = typeof finalContent === 'string' ? finalContent : JSON.stringify(finalContent);

    if (safeRole === 'assistant') {
      // Purga infalible de tokens locales para evitar fallos de codificacion
      safeContent = safeContent.split(SCHWA).join('Action: ');
      safeContent = safeContent.split('[TOOL_EXEC]').join('[Executing Action]');
    }

    if (lastMessage && lastMessage.role === safeRole) {
      lastMessage.content += `\n${safeContent}`;
      lastMessage.timestamp = lastMessage.timestamp || timestamp || IRCFormatter.getTimestamp();
    } else {
      this.history.push({
        role: safeRole,
        content: safeContent,
        timestamp: timestamp || IRCFormatter.getTimestamp(),
      });
    }
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
   * Performs a hard reset of the chat history.
   * @param {Array|null} [historyOverride] - Optional array to override the history.
   */
  hardReset(historyOverride = null) {
    this.history = historyOverride || [];
    logger.info("[CohereAdapter] History hard reset");
  }

  /**
   * Retrieves the current chat history.
   * @returns {Array} The chat history array.
   */
  getHistory() {
    return this.history;
  }

  /**
   * Fetches the list of available models from the Cohere API.
   * @returns {Promise<Array<string>>} A list of available model names.
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
   * Checks if a specific model is available and responsive.
   * @param {string} modelName - The name of the model to check.
   * @returns {Promise<boolean>} True if the model is available, false otherwise.
   */
  async checkAvailability(modelName) {
    try {
      await this.client.post("/chat", {
        model: modelName,
        messages: [{ role: "user", content: "hi" }],
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