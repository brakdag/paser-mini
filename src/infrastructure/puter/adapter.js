import fs from "fs";
import path from "path";
import { createRequire } from "module";
import BaseAdapter from "../baseAdapter.js";
import logger from "../../core/logger.js";
import RetryHandler from "../../utils/retryHandler.js";

const require = createRequire(import.meta.url);
const puterModule = require("@heyputer/puter.js/src/init.cjs");

const TOKEN_FILE = path.join(process.cwd(), ".puter-token");
const DEFAULT_MODEL = "gpt-4o-mini";
const DEFAULT_TEMPERATURE = 0.7;

/**
 * Adapter for integrating Puter AI free models into the system natively.
 * @augments BaseAdapter
 */
class PuterAdapter extends BaseAdapter {
  /**
   * Initializes the Puter adapter with SDK client, token management, and retry logic.
   * @param {object} params - The constructor parameters.
   * @param {object} params.ui - The UI interface.
   * @param {object} params.configManager - The configuration manager.
   * @param {string} [params.userNickname] - The user's nickname.
   * @param {string} [params.agentNickname] - The agent's nickname.
   */
  constructor({ ui, configManager, userNickname = "user", agentNickname = "assistant" }) {
    super({ ui, configManager, userNickname, agentNickname });
    this.history = [];
    this.currentModel = DEFAULT_MODEL;
    this.systemInstruction = null;
    this.temperature = DEFAULT_TEMPERATURE;
    this.puter = null;

    this._initializeClient();

    this.retryHandler = new RetryHandler();
    this.recoverableErrors = ["Empty response from Puter", "Failed to fetch", "ECONNRESET"];
  }

  /**
   * Initializes the Puter SDK client using a token from env or local file.
   * @private
   * @throws {Error} If no authentication token is available.
   */
  _initializeClient() {
    let token = process.env.PUTER_AUTH_TOKEN;
    
    if (!token) {
      try {
        token = fs.readFileSync(TOKEN_FILE, "utf8").trim();
      } catch {
        throw new Error("Puter auth token not found. Set PUTER_AUTH_TOKEN or create .puter-token file.");
      }
    }

    try {
      this.puter = puterModule.init(token);
      logger.info("[PuterAdapter] Puter SDK initialized successfully.");
    } catch (error) {
      logger.error(`[PuterAdapter] Failed to initialize Puter SDK: ${error.message}`);
      throw error;
    }
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
      });
    }
  }

  /**
   * Sends a message to the Puter API and returns the response.
   * @param {string|object|Array} message - The message content to send.
   * @param {string} [role] - The role of the sender.
   * @returns {Promise<string>} The response text from the API.
   * @throws {Error} If the response is empty or the request fails.
   */
  async sendMessage(message, role = "user") {
    this.injectMessage(role, message);
    const historyLengthBefore = this.history.length;

    const chatOptions = {
      model: this.currentModel,
      temperature: this.temperature,
    };

    const payload = this.history.map(({ role: msgRole, content }) => ({
      role: msgRole,
      content: this.formatTextForPayload(msgRole, content),
    }));

    await this._applyRateLimit();

    try {
      return await this.retryHandler.execute(async () => {
        try {
          const response = await this.puter.ai.chat(payload, chatOptions);
          const textContent = this._extractContent(response);

          if (!textContent) {
            throw new Error("Empty response from Puter");
          }

          this.injectMessage("assistant", textContent);
          return textContent;
        } catch (error) {
          const errMsg = typeof error.message === "object" ? JSON.stringify(error.message) : error.message;
          const apiError = new Error(errMsg);
          apiError.name = "APIError";
          throw apiError;
        }
      }, {
        recoverableErrors: this.recoverableErrors,
        /**
         * @param {number} attempt - The current attempt number.
         * @param {Error} error - The error that triggered the retry.
         * @param {string} formattedDelay - The formatted delay string.
         */
        onRetry: (attempt, error, formattedDelay) => {
          logger.warn(`[PuterAdapter] Retrying in ${formattedDelay}... (${attempt}/15) due to: ${error.message}`);
          if (this.ui && this.ui.displayInfo) {
            this.ui.displayInfo(`Reintentando Puter en ${formattedDelay}... (${attempt}/15) | Error: ${error.message}`);
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
   * Normalizes and injects a message into the chat history.
   * @param {string} role - The role of the message sender.
   * @param {string|object|Array} content - The message content.
   */
  injectMessage(role, content) {
    const apiRole = role === "server" ? "user" : role;
    let finalContent = content;

    if (Array.isArray(finalContent)) {
      finalContent = finalContent.join("\n");
    }

    if (typeof finalContent === "string" && apiRole === "assistant") {
      finalContent = finalContent.replace(/<thought>[\s\S]*?<\/thought>/gi, "").trim();
    }

    this.history.push({
      role: apiRole,
      content: finalContent,
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
   * Resets the chat history, optionally applying a new history.
   * @param {Array|null} [historyOverride] - The new history to apply.
   */
  hardReset(historyOverride = null) {
    this.history = historyOverride || [];
    if (this.systemInstruction) {
      this.injectMessage("system", this.systemInstruction);
    }
    logger.info("[PuterAdapter] History hard reset");
  }

  /**
   * Retrieves the current conversation history.
   * @returns {Array} The conversation history.
   */
  getHistory() {
    return this.history;
  }

  /**
   * Extracts text content from various Puter AI response formats (OpenAI, Anthropic, etc).
   * @param {object} response - The raw response from Puter SDK.
   * @returns {string} The extracted text content.
   * @private
   */
  _extractContent(response) {
    if (!response) return "";

    const msg = response.message;
    if (!msg) return response?.toString?.() || "";

    if (typeof msg.content === "string") {
      return msg.content;
    }

    if (Array.isArray(msg.content)) {
      return msg.content
        .filter(block => block.type === "text")
        .map(block => block.text)
        .join("");
    }

    return response?.toString?.() || "";
  }

  /**
   * Fetches the list of available models. Puter does not have a models endpoint, so we use static list.
   * @returns {Promise<string[]>} A list of available model identifiers.
   */
  async getAvailableModels() {
    return [
      "gpt-4o",
      "gpt-4o-mini",
      "gpt-4.1",
      "gpt-4.1-mini",
      "o3-mini",
      "claude-3-5-sonnet",
      "claude-3-haiku",
      "gemini-2.0-flash",
      "gemini-1.5-pro",
      "llama-3.1-70b",
      "mistral-large",
      "deepseek-chat",
      "deepseek-reasoner",
    ];
  }

  /**
   * Checks if a specific model is available and responsive.
   * @param {string} modelName - The model identifier to check.
   * @returns {Promise<boolean>} True if available, false otherwise.
   */
  async checkAvailability(modelName) {
    try {
      await this.puter.ai.chat("ping", { model: modelName });
      return true;
    } catch (error) {
      logger.warn(`[PuterAdapter] Model check failed for ${modelName}: ${error.message}`);
      return false;
    }
  }
}

export default PuterAdapter;
