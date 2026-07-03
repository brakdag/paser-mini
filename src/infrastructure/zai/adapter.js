import axios from "axios";
import axiosRetry from "axios-retry";
import BaseAdapter from "../baseAdapter.js";
import logger from "../../core/logger.js";
import IRCFormatter from "../../utils/ircFormatter.js";
import HistoryManager from "./historyManager.js";
import { parseBooleanFlag } from "./utils.js";
import {
  DEFAULT_MODELS,
  HTTP_TIMEOUT,
  MAX_RETRIES,
  MAX_RETRY_DELAY,
  MAX_TOKENS,
  RECOVERABLE_STATUS_CODES,
} from "./constants.js";

/**
 * Adapter for the Z.AI API, providing chat capabilities and history management.
 * @augments BaseAdapter
 */
class ZaiAdapter extends BaseAdapter {
  /**
   * @param {object} config - Configuration object.
   * @param {object} config.ui - The UI interface for displaying information.
   * @param {object} config.configManager - The configuration manager.
   * @param {string} [config.userNickname] - The nickname of the user.
   * @param {string} [config.agentNickname] - The nickname of the agent.
   * @param {object} [config.httpClient] - The HTTP client to use.
   */
  constructor({
    ui,
    configManager,
    userNickname = "user",
    agentNickname = "assistant",
    httpClient = axios,
  }) {
    super({ ui, configManager, userNickname, agentNickname });
    this.apiKey = process.env.ZAI_API_KEY;
    this.currentModel = "glm-5.2";
    this.systemInstruction = null;
    this.temperature = 0.7;

    this.historyManager = new HistoryManager(userNickname, agentNickname);
    this.baseURL = this._resolveBaseUrl();
    this._configureClient(httpClient);
  }

  /**
   * Resolves the API base URL for Z.AI based on config or env vars.
   * @private
   * @returns {string} The resolved base URL.
   */
  _resolveBaseUrl() {
    const STANDARD = "https://api.z.ai/api/paas/v4";
    const CODING = "https://api.z.ai/api/coding/paas/v4";

    if (process.env.ZAI_BASE_URL) return process.env.ZAI_BASE_URL.trim();

    const configUrl = this.configManager?.get?.("zai_base_url");
    if (configUrl && typeof configUrl === "string") return configUrl.trim();

    const codingFlag =
      process.env.ZAI_CODING_PLAN ||
      this.configManager?.get?.("zai_coding_plan");
    if (parseBooleanFlag(codingFlag)) return CODING;

    return STANDARD;
  }

  /**
   * Configures the axios client with base URL, timeout, headers, and retry logic.
   * @private
   * @param {object} httpClient - The axios instance to configure.
   */
  _configureClient(httpClient) {
    this.client = httpClient.create({
      baseURL: this.baseURL,
      timeout: HTTP_TIMEOUT,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
    });

    axiosRetry(this.client, {
      retries: MAX_RETRIES,
      retryDelay: axiosRetry.exponentialDelay,
      /**
       * Determines if a request should be retried based on the error.
       * @param {Error} error - The error object.
       * @returns {boolean} True if the request should be retried.
       */
      retryCondition: (error) => {
        const status = error.response?.status;
        return (
          axiosRetry.isNetworkOrIdempotentRequestError(error) ||
          RECOVERABLE_STATUS_CODES.includes(status)
        );
      },
      /**
       * Logs retry attempts and notifies the UI.
       * @param {number} retryCount - The current retry attempt number.
       * @param {Error} error - The error that caused the retry.
       */
      onRetry: (retryCount, error) => {
        const time = IRCFormatter.getTimestamp();
        const errorMsg = error.response?.status || error.message;
        const msg = `[${time}] -!- [ZaiAdapter] API Retry ${retryCount}/${MAX_RETRIES} due to: ${errorMsg}`;
        logger.warn(msg);
        if (this.ui && this.ui.displayInfo) {
          this.ui.displayInfo(
            `Reintentando Z.AI... (${retryCount}/${MAX_RETRIES}) | Error: ${errorMsg}`,
          );
        }
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
    logger.info(
      `[ZaiAdapter] startChat initialized. Model: ${this.currentModel} | Endpoint: ${this.baseURL}`,
    );
  }

  /**
   * Formats milliseconds into a human-readable string (e.g., "2.5h", "45m").
   * @param {number} ms - Milliseconds.
   * @returns {string} Formatted time string.
   * @private
   */
  _formatDelay(ms) {
    const seconds = Math.floor(ms / 1000);
    const hours = seconds / 3600;
    if (hours >= 1) return `${hours.toFixed(1)}h`;
    const minutes = seconds / 60;
    if (minutes >= 1) return `${minutes.toFixed(0)}m`;
    return `${seconds}s`;
  }

  /**
   * Calculates the exponential backoff delay with a maximum cap.
   * @param {number} attempt - The current attempt number (1-indexed).
   * @returns {number} Delay in milliseconds.
   * @private
   */
  _getExponentialDelay(attempt) {
    const delay = 2 ** attempt * 1000;
    return Math.min(delay, MAX_RETRY_DELAY);
  }

  /**
   * Sends a message to the Z.AI API and records the interaction in history.
   * @param {string|object|Array} message - The message content to send.
   * @param {string} [role] - The role of the sender.
   * @returns {Promise<string>} The response text from the AI.
   * @throws {Error} If the API request fails.
   */
  async sendMessage(message, role = "user") {
    const timestamp = IRCFormatter.getTimestamp();
    this.injectMessage(role, message, timestamp);

    const payload = this._preparePayload();
    let lastError = null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
      try {
        logger.info(
          `[ZaiAdapter] Requesting (Attempt ${attempt}/${MAX_RETRIES}): ${this.client.defaults.baseURL}/chat/completions`,
        );
        const response = await this.client.post("/chat/completions", payload);
        return this._handleResponse(response);
      } catch (error) {
        lastError = error;
        const isEmptyResponseError = error.message === "Empty response from Z.AI";

        if (!isEmptyResponseError) {
          throw this._handleApiError(error);
        }

        const delay = this._getExponentialDelay(attempt);
        const formattedDelay = this._formatDelay(delay);
        logger.warn(
          `[ZaiAdapter] Empty response received. Retrying in ${formattedDelay}... (Attempt ${attempt}/${MAX_RETRIES})`,
        );
        if (this.ui && this.ui.displayInfo) {
          this.ui.displayInfo(
            `Empty response from Z.AI. Retrying in ${formattedDelay}... (${attempt}/${MAX_RETRIES})`,
          );
        }
        await new Promise((resolve) => {
          setTimeout(resolve, delay);
        });
      }
    }

    throw this._handleApiError(lastError || new Error("Max retries reached with empty response."));
  }

  /**
   * Prepares the payload for the Z.AI /chat/completions endpoint.
   *
   * Prepends the system instruction as the leading {role:"system"} message
   * (OpenAI/Z.AI convention), matching the NVIDIA adapter pattern. This is
   * done at payload-build time rather than stored in history, so history
   * stays conversation-only and the instruction is always fresh from
   * startChat(). Idempotent: skips injection if history already leads with
   * a system message (e.g. after hardReset).
   * @private
   * @returns {object} The formatted payload.
   */
  _preparePayload() {
    const messages = this.getHistory().map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));

    const hasSystem = messages.length > 0 && messages[0].role === "system";
    if (this.systemInstruction && !hasSystem) {
      messages.unshift({ role: "system", content: this.systemInstruction });
    }

    return {
      model: this.currentModel,
      messages,
      temperature: this.temperature,
      thinking: {
        type: "enabled",
      },
      reasoning_effort: "max",
      max_tokens: MAX_TOKENS,
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
    const textContent = response.data.choices?.[0]?.message?.content;

    if (textContent) {
      const msgTimestamp = IRCFormatter.getTimestamp();
      this.injectMessage("assistant", textContent, msgTimestamp);
      return textContent;
    }

    throw new Error("Empty response from Z.AI");
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
    this.historyManager.injectMessage(role, content, timestamp);
  }

  /**
   * Removes the last message from the chat history.
   */
  popLastMessage() {
    this.historyManager.popLastMessage();
  }

  /**
   * Resets the chat history, optionally with a new history array.
   * @param {Array|null} [historyOverride] - The new history to set.
   */
  hardReset(historyOverride = null) {
    this.historyManager.hardReset(historyOverride);
    if (this.systemInstruction) {
      this.injectMessage("system", this.systemInstruction);
    }
    logger.info("[ZaiAdapter] History hard reset");
  }

  /**
   * Retrieves the current chat history.
   * @returns {Array} The history array.
   */
  getHistory() {
    return this.historyManager.getHistory();
  }

  /**
   * Fetches the list of available models from the Z.AI API.
   * @returns {Promise<string[]>} A list of model names.
   */
  async getAvailableModels() {
    try {
      const response = await this.client.get("/models");
      return response.data.data.map((m) => m.id);
    } catch (error) {
      logger.error(`[ZaiAdapter] Error fetching models: ${error.message}`);
      return DEFAULT_MODELS;
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
        `[ZaiAdapter] Availability check failed for ${modelName}: ${error.message}`,
      );
      throw error; // Fail explicitly on unknown errors
    }
  }
}

export default ZaiAdapter;
