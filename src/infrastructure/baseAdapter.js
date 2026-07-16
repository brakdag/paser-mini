import IRCFormat from "../formats/IRCFormat.js";
import CleanFormat from "../formats/CleanFormat.js";
import FountainFormat from "../formats/FountainFormat.js";
import logger from "../core/logger.js";

/**
 * Base class for AI adapters. This class is abstract and cannot be instantiated directly.
 */
export default class BaseAdapter {
  /**
   * @param {object} config - Configuration object for the adapter.
   * @param {object} config.ui - The UI interface.
   * @param {object} config.configManager - The configuration manager.
   * @throws {Error} If instantiated directly.
   */
  constructor({ ui, configManager }) {
    if (this.constructor === BaseAdapter) {
      throw new Error(
        "BaseAdapter is an abstract class and cannot be instantiated directly.",
      );
    }
    this.ui = ui;
    this.configManager = configManager;
    this.user = { nickname: "user" };
    this.model = { nickname: "assistant" };
    this.ircFormatter = new IRCFormat();
    this.cleanFormatter = new CleanFormat();
    this.fountainFormatter = new FountainFormat();
    this.renderingMode = "IRC";
    this.immersionMode = false;
    this.lastRequestTime = 0;
  }

  /**
   * Injects the shared user and model identity objects.
   * @param {object} user The user identity object.
   * @param {object} model The model identity object.
   */
  setIdentities(user, model) {
    this.user = user;
    this.model = model;
  }

  /**
   * Ensures the request rate does not exceed the defined RPM limit.
   * @returns {Promise<void>}
   */
  async _applyRateLimit() {
    const rpmLimit = Math.max(1, parseInt(this.configManager.get("rpm_limit", 15), 10) || 1);
    const minInterval = 60000 / rpmLimit;
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;

    if (elapsed < minInterval) {
      const waitTime = minInterval - elapsed;
      logger.debug(
        `[${this.constructor.name}] Rate Limit: Waiting ${waitTime / 1000}s to maintain ${rpmLimit} RPM`,
      );
      await new Promise((resolve) => {
        setTimeout(resolve, waitTime);
      });
    }
    this.lastRequestTime = Date.now();
  }

  /**
   * Formats text for the API payload based on the current Immersion Mode.
   * @param {string} role - The role of the sender ('user' or 'model'/'assistant').
   * @param {string} text - The raw text content.
   * @param {string|null} [timestamp] - Optional timestamp.
   * @returns {string} The formatted text.
   */
  formatTextForPayload(role, text, timestamp = null) {
    if (!this.immersionMode || this.renderingMode === "CLEAN") {
      return text;
    }

    let normalizedRole = role;
    if (role === "assistant" || role === "model") normalizedRole = "model";
    else if (role === "server") normalizedRole = "system";

    let nickname;
    if (normalizedRole === "user") {
      nickname = this.user.nickname;
    } else if (normalizedRole === "system") {
      nickname = "system";
    } else {
      nickname = this.model.nickname;
    }

    if (this.renderingMode === "IRC") {
      return this.ircFormatter.formatMessage(nickname, text, timestamp);
    }
    if (this.renderingMode === "FOUNTAIN") {
      return this.fountainFormatter.formatMessage(nickname, text);
    }

    return text;
  }

  /**
   * Sets the rendering mode for the adapter.
   * @param {string} mode - The rendering mode ('IRC', 'FOUNTAIN', 'CLEAN').
   */
  setRenderingMode(mode) {
    this.renderingMode = mode;
  }

  /**
   * Enables or disables the Immersion Mode (raw formatting in payloads).
   * @param {boolean} active - True to enable, false to disable.
   */
  setImmersionMode(active) {
    this.immersionMode = active;
  }

  /**
   * Helper method to calculate the character length of a message regardless of its structural shape.
   * Supports standard 'content', NVIDIA's 'text', and Gemini's 'parts'.
   * @param {object} msg - The message object.
   * @returns {number} The total character length of the message content.
   * @private
   */
  _getMessageLength(msg) {
    if (typeof msg.content === "string") return msg.content.length;
    if (typeof msg.text === "string") return msg.text.length;
    if (Array.isArray(msg.parts)) {
      return msg.parts.reduce((acc, part) => acc + (typeof part.text === "string" ? part.text.length : 0), 0);
    }
    return JSON.stringify(msg).length;
  }

  /**
   * Retrieves the specific character-to-token heuristic for the model.
   * Subclasses can override this to match their specific tokenizers.
   * @returns {number} The characters per token.
   */
  getCharsPerToken() {
    return 3.5; // Default heuristic for OpenAI/Gemini/Llama3
  }

  /**
   * The Guardian of Context. Trims the conversation history to fit within the configured token limit.
   * Preserves the initial system instruction and purges the oldest messages (FIFO) implacably.
   * @private
   */
  _enforceContextLimit() {
    const limit = parseInt(this.configManager.get("context_window_limit", 0), 10);
    if (!limit || limit <= 0) return; // 0 means infinite, disabled

    const history = this.getHistory();
    if (!history || history.length === 0) return;

    const charsPerToken = this.getCharsPerToken();
    const maxChars = limit * charsPerToken;
    let systemChars = 0;
    
    // Calculate system instruction chars only if it's not already in history (OpenAI style)
    const historyHasSystem = history.some(msg => msg.role === 'system' || msg.role === 'server');
    if (!historyHasSystem && typeof this.systemInstruction === 'string') {
      systemChars = this.systemInstruction.length;
    }

    let totalChars = history.reduce((acc, msg) => acc + this._getMessageLength(msg), 0) + systemChars;

    if (totalChars <= maxChars) return;

    // Implacable purge: Start from index 1 (preserving the initial system prompt at index 0)
    const currentIndex = history.length > 1 && (history[0].role === 'system' || history[0].role === 'server') ? 1 : 0;

    // Keep purging as long as we exceed the limit and have more than one message to remove
    while (totalChars > maxChars && history.length > currentIndex + 1) {
      const removed = history.splice(currentIndex, 1)[0];
      totalChars -= this._getMessageLength(removed);
      logger.debug(`[${this.constructor.name}] Context limit exceeded. Purged 1 older message to maintain strict ${limit} token limit.`);
    }

    // Surgical truncation as a last resort if a single message paralyzes the limit
    if (totalChars > maxChars && history.length > 0) {
      const overflowChars = totalChars - maxChars;
      const lastMsg = history[history.length - 1];
      const msgLength = this._getMessageLength(lastMsg);
      if (msgLength > overflowChars) {
        if (typeof lastMsg.text === 'string') {
          lastMsg.text = lastMsg.text.slice(0, lastMsg.text.length - overflowChars);
        } else if (typeof lastMsg.content === 'string') {
          lastMsg.content = lastMsg.content.slice(0, lastMsg.content.length - overflowChars);
        }
        logger.error(`[${this.constructor.name}] CRITICAL: Single message exceeded the strict limit. Applied surgical truncation.`);
      }
    }
  }

  /**
   * The Absolute Wall. Trims the final payload to ensure it strictly respects the token limit before network transmission.
   * This operates on the formatted messages to account for any overhead added during payload preparation.
   * @param {Array<object>} messages - The formatted messages ready to be sent to the API.
   * @returns {Array<object>} The strictly trimmed messages array.
   */
  _enforcePayloadLimit(messages) {
    const limit = parseInt(this.configManager.get("context_window_limit", 0), 10);
    if (!limit || limit <= 0) return messages; // 0 means disabled
    if (!messages || messages.length === 0) return messages;

    const charsPerToken = this.getCharsPerToken();
    const maxChars = limit * charsPerToken;
    
    // Calculate total characters based on the formatted 'content' field
    let totalChars = messages.reduce((acc, msg) => {
      const content = typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content || "");
      return acc + content.length;
    }, 0);

    if (totalChars <= maxChars) return messages;

    // Find the first non-system message index to start the purge
    let firstNonSystemIndex = 0;
    while (
      firstNonSystemIndex < messages.length && 
      (messages[firstNonSystemIndex].role === "system" || messages[firstNonSystemIndex].role === "server")
    ) {
      firstNonSystemIndex += 1;
    }

    // Implacable purge on the formatted payload
    while (totalChars > maxChars && firstNonSystemIndex < messages.length - 1) {
      const removed = messages.splice(firstNonSystemIndex, 1)[0];
      const removedContent = typeof removed.content === "string" ? removed.content : JSON.stringify(removed.content || "");
      totalChars -= removedContent.length;
      logger.warn(`[${this.constructor.name}] PAYLOAD LIMIT: Hard-trimmed 1 formatted message to prevent API ban. Limit: ${limit}t`);
    }

    // Surgical Truncation on the formatted payload
    if (totalChars > maxChars && messages.length > 0) {
      const lastMsg = messages[messages.length - 1];
      const overflowChars = totalChars - maxChars;
      
      if (typeof lastMsg.content === "string" && lastMsg.content.length > overflowChars) {
        lastMsg.content = lastMsg.content.slice(0, lastMsg.content.length - overflowChars);
        logger.error(`[${this.constructor.name}] CRITICAL PAYLOAD LIMIT: Applied surgical truncation to final message content.`);
      }
    }

    return messages;
  }

  /**
   * Sends a message to the AI provider.
   * @param {string|object|Array} _message - The message content to send.
   * @param {string} [_role] - The role of the sender.
   * @returns {Promise<string>} The response text from the AI.
   * @throws {Error} If the method is not implemented by the subclass.
   */
  async sendMessage(_message, _role = "user") {
    throw new Error("Method 'sendMessage()' must be implemented.");
  }

  /**
   * Initializes or updates the chat session parameters.
   * @param {string} _modelName - The name of the model to use.
   * @param {string} _systemInstruction - The system prompt/preamble.
   * @param {number} [_temperature] - The sampling temperature.
   * @throws {Error} If the method is not implemented by the subclass.
   */
  startChat(_modelName, _systemInstruction, _temperature = 0.7) {
    throw new Error("Method 'startChat()' must be implemented.");
  }

  /**
   * Normalizes and injects a message into the chat history.
   * @param {string} _role - The role of the message sender.
   * @param {string|object|Array} _content - The content of the message.
   * @param {string|null} [_timestamp] - The timestamp of the message.
   * @throws {Error} If the method is not implemented by the subclass.
   */
  injectMessage(_role, _content, _timestamp = null) {
    throw new Error("Method 'injectMessage()' must be implemented.");
  }

  /**
   * Removes the last message from the chat history.
   * @throws {Error} If the method is not implemented by the subclass.
   */
  popLastMessage() {
    throw new Error("Method 'popLastMessage()' must be implemented.");
  }

  /**
   * Retrieves the current chat history. Subclasses should return an Array.
   * @throws {Error} If the method is not implemented by the subclass.
   */
  getHistory() {
    throw new Error("Method 'getHistory()' must be implemented.");
  }

  /**
   * Fetches the list of available models from the AI provider.
   * @returns {Promise<string[]>} A list of model names.
   * @throws {Error} If the method is not implemented by the subclass.
   */
  async getAvailableModels() {
    throw new Error("Method 'getAvailableModels()' must be implemented.");
  }

  /**
   * Checks if a specific model is available and responding.
   * @param {string} _modelName - The name of the model to check.
   * @returns {Promise<boolean>} True if available, false otherwise.
   * @throws {Error} If the method is not implemented by the subclass.
   */
  async checkAvailability(_modelName) {
    throw new Error("Method 'checkAvailability()' must be implemented.");
  }
}