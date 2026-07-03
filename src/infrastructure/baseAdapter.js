import IRCFormat from "../formats/IRCFormat.js";
import CleanFormat from "../formats/CleanFormat.js";
import FountainFormat from "../formats/FountainFormat.js";

/**
 * Base class for AI adapters. This class is abstract and cannot be instantiated directly.
 */
export default class BaseAdapter {
  /**
   * @param {object} config - Configuration object for the adapter.
   * @param {object} config.ui - The UI interface.
   * @param {object} config.configManager - The configuration manager.
   * @param {string} [config.userNickname] - The user's nickname.
   * @param {string} [config.agentNickname] - The agent's nickname.
   * @throws {Error} If instantiated directly.
   */
  constructor({
    ui,
    configManager,
    userNickname = "user",
    agentNickname = "assistant",
  }) {
    if (this.constructor === BaseAdapter) {
      throw new Error(
        "BaseAdapter is an abstract class and cannot be instantiated directly.",
      );
    }
    this.ui = ui;
    this.configManager = configManager;
    this.userNickname = userNickname;
    this.agentNickname = agentNickname;
    this.ircFormatter = new IRCFormat();
    this.cleanFormatter = new CleanFormat();
    this.fountainFormatter = new FountainFormat();
    this.renderingMode = "IRC";
    this.immersionMode = false;
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
      nickname = this.ui.userNickname;
    } else if (normalizedRole === "system") {
      nickname = "system";
    } else {
      nickname = this.ui.agentNickname;
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
   * Updates the nicknames for the user and the agent.
   * @param {string} userNickname - The new nickname for the user.
   * @param {string} agentNickname - The new nickname for the agent.
   */
  updateNicknames(userNickname, agentNickname) {
    this.userNickname = userNickname;
    this.agentNickname = agentNickname;
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

  /**
   * Returns the available variants for this adapter.
   * @returns {Array} A list of variants.
   */
  getVariants() {
    return [];
  }
}