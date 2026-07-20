import axios from "axios";
import BaseAdapter from "../baseAdapter.js";
import logger from "../../core/logger.js";
import IRCFormatter from "../../utils/ircFormatter.js";
import RetryHandler from "../../utils/retryHandler.js";
import { normalizeRole, normalizeContent } from "../historyNormalizer.js";

const BASE_URL = "https://models.github.ai";
const API_VERSION = "2026-03-10";
const DEFAULT_MODEL = "openai/gpt-4.1";
const DEFAULT_TEMPERATURE = 0.7;

/**
 * Adapter for the GitHub Models API, providing chat capabilities and history management.
 * @augments BaseAdapter
 */
class GithubAdapter extends BaseAdapter {
  /**
   * @param {object} params - The constructor parameters.
   * @param {object} params.ui - The UI interface.
   * @param {object} params.configManager - The configuration manager.
   * @param {string} [params.userNickname] - The user's nickname.
   * @param {string} [params.agentNickname] - The agent's nickname.
   */
  constructor({ ui, configManager, userNickname = "user", agentNickname = "assistant" }) {
    super({ ui, configManager, userNickname, agentNickname });
    this.apiKey = process.env.GITHUB_API_KEY;
    this.history = [];
    this.currentModel = DEFAULT_MODEL;
    this.systemInstruction = null;
    this.temperature = DEFAULT_TEMPERATURE;
    this.lastRequestTime = 0;

    this._configureClient();
    this.retryHandler = new RetryHandler();
    this.recoverableErrors = ["Empty response from GitHub Models"];
  }

  /**
   * Configures the axios client with base URL, timeout, and headers required by GitHub.
   * @private
   */
  _configureClient() {
    this.client = axios.create({
      baseURL: BASE_URL,
      timeout: 600000,
      headers: {
        "Authorization": `Bearer ${this.apiKey}`,
        "X-GitHub-Api-Version": API_VERSION,
        "Accept": "application/vnd.github+json",
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

    if (!this.systemInstruction) return;

    if (this.history.length > 0 && this.history[0].role === "system") {
      this.history[0].content = this.systemInstruction;
    } else {
      this.history.unshift({
        role: "system",
        content: this.systemInstruction,
        timestamp: IRCFormatter.getTimestamp(),
      });
    }
  }

  /**
   * Sends a message to the GitHub Models API and returns the response text.
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
          logger.info(`[GithubAdapter] Requesting: ${this.client.defaults.baseURL}/inference/chat/completions`);
          logger.debug(`[GithubAdapter] Payload: ${JSON.stringify(payload)}`);

          const response = await this.client.post("/inference/chat/completions", payload);
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
          logger.warn(`[GithubAdapter] Retrying in ${formattedDelay}... (${attempt}/15) due to: ${error.message}`);
          if (this.ui && this.ui.displayInfo) {
            this.ui.displayInfo(`Retrying GitHub Models in ${formattedDelay}... (${attempt}/15) | Error: ${error.message}`);
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
   * Prepares the payload for the GitHub Models /inference/chat/completions endpoint.
   * @private
   * @returns {object} The formatted payload.
   */
  _preparePayload() {
    return {
      model: this.currentModel,
      messages: this.history.map(({ role: msgRole, content, timestamp }) => ({
        role: msgRole,
        content: this.formatTextForPayload(msgRole, content, timestamp)
      })),
      temperature: this.temperature,
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
    const textContent = response.data.choices[0].message.content;

    if (textContent) {
      const msgTimestamp = IRCFormatter.getTimestamp();
      this.injectMessage("assistant", textContent, msgTimestamp);
      return textContent;
    }

    throw new Error("Empty response from GitHub Models");
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
    apiError.response = error.response;
    apiError.code = error.code;
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
    if (this.systemInstruction) {
      this.injectMessage("system", this.systemInstruction);
    }
    logger.info("[GithubAdapter] History hard reset");
  }

  /**
   * Retrieves the current chat history.
   * @returns {Array} The history array.
   */
  getHistory() {
    return this.history;
  }

  /**
   * Fetches the list of available models from the GitHub Models API.
   * @returns {Promise<string[]>} A list of model names.
   */
  async getAvailableModels() {
    try {
      const response = await this.client.get("/catalog/models");
      return response.data.map((m) => m.id).sort();
    } catch (error) {
      logger.error(`[GithubAdapter] Error fetching models: ${error.message}`);
      return ["openai/gpt-4.1", "meta/Llama-3.3-70B-Instruct"];
    }
  }

  /**
   * Checks if a specific model is available and responding.
   * @param {string} modelName - The name of the model to check.
   * @returns {Promise<boolean>} True if available, false otherwise.
   */
  async checkAvailability(modelName) {
    try {
      await this.client.post("/inference/chat/completions", {
        model: modelName,
        messages: [{ role: "user", content: "hi" }],
        max_tokens: 1,
      });
      return true;
    } catch (error) {
      const status = error.response?.status;
      if (status === 404 || status === 400) return false;
      logger.warn(
        `[GithubAdapter] Availability check failed for ${modelName}: ${error.message}`,
      );
      throw error;
    }
  }
}

export default GithubAdapter;
