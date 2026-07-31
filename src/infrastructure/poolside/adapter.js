import axios from "axios";
import BaseAdapter from "../baseAdapter.js";
import logger from "../../core/logger.js";
import IRCFormatter from "../../utils/ircFormatter.js";
import RetryHandler from "../../utils/retryHandler.js";
import { normalizeRole, normalizeContent } from "../historyNormalizer.js";

const BASE_URL = "https://inference.poolside.ai/v1";
const DEFAULT_MODEL = "poolside/laguna-s-2.1";
const DEFAULT_TEMPERATURE = 0.7;
const REQUEST_TIMEOUT_MS = 10 * 60 * 1000;
const MAX_RETRY_ATTEMPTS = 15;
const FALLBACK_MODELS = ["poolside/laguna-s-2.1", "poolside/laguna-xs-2.1"];

/**
 * Adapter for the Poolside AI API, providing chat capabilities and history management.
 * @augments BaseAdapter
 */
class PoolsideAdapter extends BaseAdapter {
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
   * @returns {Promise<string>} The response text from the AI.
   * @throws {Error} If the API request fails.
   */
  async sendMessage(message, role = "user") {
    const timestamp = IRCFormatter.getTimestamp();
    this.injectMessage(role, message, timestamp);
    this._enforceContextLimit();
    const historyLengthBefore = this.history.length;

    try {
      return await this._dispatchMessage();
    } catch (error) {
      this._rollbackOnFailure(historyLengthBefore);
      throw error;
    }
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
    if (this.systemInstruction) {
      this.injectMessage("system", this.systemInstruction);
    }
    logger.info("[PoolsideAdapter] History hard reset");
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
    if (!this.systemInstruction) return;

    const hasSystemAtStart = this.history[0]?.role === "system";
    if (hasSystemAtStart) {
      this.history[0].content = this.systemInstruction;
      return;
    }

    this.history.unshift({
      role: "system",
      content: this.systemInstruction,
      timestamp: IRCFormatter.getTimestamp(),
    });
  }

  /**
   * Applies rate limiting, prepares the payload, and dispatches the request with retry semantics.
   * @private
   * @returns {Promise<string>} The assistant's text response.
   */
  async _dispatchMessage() {
    await this._applyRateLimit();
    const payload = this._preparePayload();

    return this.retryHandler.execute(
      () => this._executeRequest(payload),
      {
        recoverableErrors: this.recoverableErrors,
        onRetry: this._logRetry.bind(this),
      },
    );
  }

  /**
   * Executes a single HTTP request against the chat completions endpoint.
   * @private
   * @param {object} payload - The request payload to send.
   * @returns {Promise<string>} The assistant's text response.
   */
  async _executeRequest(payload) {
    logger.info(`[PoolsideAdapter] Requesting: ${this.client.defaults.baseURL}/chat/completions`);
    logger.debug(`[PoolsideAdapter] Payload: ${JSON.stringify(payload)}`);

    try {
      const response = await this.client.post("/chat/completions", payload);
      return this._handleResponse(response);
    } catch (error) {
      throw this._handleApiError(error);
    }
  }

  /**
   * Logs a retry attempt and surfaces it to the UI when available.
   * @private
   * @param {number} attempt - The current attempt number (1-indexed).
   * @param {Error} error - The error that triggered the retry.
   * @param {string} formattedDelay - The human-readable delay before the next attempt.
   * @returns {void}
   */
  _logRetry(attempt, error, formattedDelay) {
    logger.warn(`[PoolsideAdapter] Retrying in ${formattedDelay}... (${attempt}/${MAX_RETRY_ATTEMPTS}) due to: ${error.message}`);
    if (this.ui && this.ui.displayInfo) {
      this.ui.displayInfo(`Retrying Poolside in ${formattedDelay}... (${attempt}/${MAX_RETRY_ATTEMPTS}) | Error: ${error.message}`);
    }
  }

  /**
   * Rolls back the most recently injected message when the request fails before any history mutation.
   * @private
   * @param {number} historyLengthBefore - The history length captured before the request was dispatched.
   * @returns {void}
   */
  _rollbackOnFailure(historyLengthBefore) {
    if (this.history.length === historyLengthBefore) {
      this.popLastMessage();
    }
  }

  /**
   * Builds the payload for the /chat/completions endpoint from the current history.
   * @private
   * @returns {object} The formatted payload ready for transmission.
   */
  _preparePayload() {
    return {
      model: this.currentModel,
      messages: this.history.map(({ role: msgRole, content, timestamp }) => ({
        role: msgRole,
        content: this.formatTextForPayload(msgRole, content, timestamp),
      })),
      temperature: this.temperature,
      max_tokens: this.getMaxOutputTokens(),
    };
  }

  /**
   * Extracts the assistant text from the API response and injects it into history.
   * @private
   * @param {object} response - The axios response object.
   * @returns {string} The extracted text content.
   * @throws {Error} If the response text is empty.
   */
  _handleResponse(response) {
    const textContent = response.data.choices[0].message.content;

    if (textContent) {
      const msgTimestamp = IRCFormatter.getTimestamp();
      this.injectMessage("assistant", textContent, msgTimestamp);
      return textContent;
    }

    throw new Error("Empty response from Poolside");
  }

  /**
   * Normalizes an API error into a standardized Error object with the APIError name.
   * @private
   * @param {Error} error - The caught error object.
   * @returns {Error} A formatted Error object with name "APIError".
   */
  _handleApiError(error) {
    const errorMsg = error.response?.data?.error?.message || error.message;
    const apiError = new Error(errorMsg);
    apiError.name = "APIError";
    apiError.response = error.response;
    apiError.code = error.code;
    return apiError;
  }
}

export default PoolsideAdapter;
