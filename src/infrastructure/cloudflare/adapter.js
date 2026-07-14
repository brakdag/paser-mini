import axios from "axios";
import BaseAdapter from "../baseAdapter.js";
import logger from "../../core/logger.js";
import RetryHandler from "../../utils/retryHandler.js";
import IRCFormatter from "../../utils/ircFormatter.js";
import { normalizeRole, normalizeContent, countTokensHeuristic } from "../historyNormalizer.js";

const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const BASE_URL = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/ai/v1`;
const DEFAULT_MODEL = "@cf/meta/llama-3.1-8b-instruct";
const DEFAULT_TEMPERATURE = 0.7;
const CHARS_PER_TOKEN = 3.5;

/**
 * Adapter for integrating Cloudflare Workers AI models into the system.
 */
class CloudflareAdapter extends BaseAdapter {
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
   * Sends a message to the Cloudflare API and returns the response.
   * @param {string} message - The message content to send.
   * @param {string} [role] - The role of the sender.
   * @returns {Promise<string>} The response text from the API.
   * @throws {Error} If the response is empty or the request fails.
   */
  async sendMessage(message, role = "user") {
    this.injectMessage(role, message, IRCFormatter.getTimestamp());
    this._enforceContextLimit(); // Apply strict context boundary before API call
    const historyLengthBefore = this.history.length;

    const payload = {
      model: this.currentModel,
      messages: this.history.map(({ role: msgRole, content, timestamp }) => ({
        role: msgRole,
        content: this.formatTextForPayload(msgRole, content, timestamp)
      })),
      temperature: this.temperature,
    };
    this.lastPayload = payload;

    await this._applyRateLimit();

    try {
      return await this.retryHandler.execute(async () => {
        try {
          const response = await this.client.post("/chat/completions", payload);
          const textContent = response.data.choices[0].message.content;

          if (!textContent) {
            throw new Error("Empty response from Cloudflare");
          }

          this.injectMessage("assistant", textContent, IRCFormatter.getTimestamp());
          return textContent;
        } catch (error) {
          const errorMsg = error.response?.data?.error?.message || error.message;
          const apiError = new Error(errorMsg);
          apiError.name = "APIError";
          apiError.response = error.response;
          apiError.code = error.code;
          throw apiError;
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
          logger.warn(`[CloudflareAdapter] Retrying in ${formattedDelay}... (${attempt}/15) due to: ${error.message}`);
          if (this.ui && this.ui.displayInfo) {
            this.ui.displayInfo(`Retrying Cloudflare in ${formattedDelay}... (${attempt}/15) | Error: ${error.message}`);
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
   * Injects a message into the conversation history with normalized role and content.
   * @param {string} role - The role of the message sender.
   * @param {string|object|Array} content - The message content.
   * @param {string|null} [timestamp] - The message timestamp.
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
    this.history = historyOverride || [];
    if (this.systemInstruction) {
      this.injectMessage("system", this.systemInstruction);
    }
    logger.info("[CloudflareAdapter] History hard reset");
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
