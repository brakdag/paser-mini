import { setTimeout as delay } from "node:timers/promises";
import { randomUUID } from "node:crypto";
import IRCFormat from "../formats/IRCFormat.js";
import CleanFormat from "../formats/CleanFormat.js";
import FountainFormat from "../formats/FountainFormat.js";
import logger from "../core/logger.js";
import { contextSettings, estimateContextTokens, planContext } from "./contextBudget.js";

/**
 * Base class for AI adapters. This class is abstract and cannot be instantiated directly.
 */
export default class BaseAdapter {
  systemInstructionInHistory = false;

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
   * Replaces the prompt without restarting the model or clearing conversation messages.
   * Adapters that store the prompt in history opt in with systemInstructionInHistory.
   * @param {string} systemInstruction - The replacement system prompt, or empty to remove it.
   */
  updateSystemInstruction(systemInstruction) {
    this.systemInstruction = systemInstruction;
    if (!this.systemInstructionInHistory) return;
    const history = this.getHistory();
    if (history[0]?.role === "system") {
      if (systemInstruction) history[0].content = systemInstruction;
      else history.shift();
    } else if (systemInstruction) {
      history.unshift({ role: "system", content: systemInstruction });
    }
  }

  /**
   * Ensures the request rate does not exceed the defined RPM limit.
   * @param {AbortSignal} [signal] - Cancels the rate-limit wait.
   * @returns {Promise<void>}
   */
  async _applyRateLimit(signal) {
    signal?.throwIfAborted();
    const rpmLimit = Math.max(1, parseInt(this.configManager.get("rpm_limit", 15), 10) || 1);
    const minInterval = 60000 / rpmLimit;
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;

    if (elapsed < minInterval) {
      const waitTime = minInterval - elapsed;
      logger.debug(
        `[${this.constructor.name}] Rate Limit: Waiting ${waitTime / 1000}s to maintain ${rpmLimit} RPM`,
      );
      await delay(waitTime, undefined, { signal });
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
   * Retrieves the specific character-to-token heuristic for the model.
   * Subclasses can override this to match their specific tokenizers.
   * @returns {number} The characters per token.
   */
  getCharsPerToken() {
    return 3.5; // Default heuristic for OpenAI/Gemini/Llama3
  }

  /**
   * Retrieves the reserved token space for the model's output (max_tokens).
   * Subclasses can override this to enforce their specific limits.
   * @returns {number} The number of tokens to reserve for the response.
   */
  getMaxOutputTokens() {
    return contextSettings(0, this.configManager.get("max_tokens", 4096), this.getCharsPerToken()).output;
  }

  #contextTurn = null;

  #pendingEntries = null;

  /** Marks one user turn, including its tool exchanges and recovery requests. */
  beginContextTurn() {
    if (this.#contextTurn) throw new Error("A context turn is already active");
    this.#contextTurn = randomUUID();
  }

  /** Finishes turn grouping without deleting its history identifiers. */
  endContextTurn() {
    this.#contextTurn = null;
  }

  /**
   * Tags entries added during the pending request; system instructions stay pinned.
   */
  _tagContextEntries() {
    if (!this.#pendingEntries || !this.#contextTurn) return;
    this.getHistory().forEach(message => {
      if (!this.#pendingEntries.has(message) && !["system", "developer"].includes(message.role)) {
        Object.assign(message, { contextTurn: this.#contextTurn });
      }
    });
  }

  /**
   * Reads and validates the common context settings.
   * @returns {{limit: number, output: number, charsPerToken: number}} Policy.
   */
  _contextSettings() {
    return contextSettings(this.configManager.get("context_window_limit", 0), this.getMaxOutputTokens(), this.getCharsPerToken());
  }

  /**
   * Checks a proposed setting before it is persisted or history is modified.
   * @param {number} limit - Proposed local context limit.
   */
  checkContextLimit(limit) {
    const settings = contextSettings(limit, this.getMaxOutputTokens(), this.getCharsPerToken());
    planContext(this.getHistory(), settings, this.systemInstruction);
  }

  /** Plans complete-turn trimming atomically; never slices message contents. */
  _enforceContextLimit() {
    this._tagContextEntries();
    const settings = this._contextSettings();
    if (!settings.limit) return;
    const history = this.getHistory();
    const retained = planContext(history, settings, this.systemInstruction);
    if (retained.length !== history.length) {
      const removed = history.length - retained.length;
      history.splice(0, history.length, ...retained);
      this.ui?.displayInfo?.(`Context estimate: removed ${removed} messages in complete older turns to fit ${settings.limit} tokens.`);
    }
  }

  /**
   * Validates a formatted payload without destructively trimming messages.
   * @param {object[]} messages - Final provider messages.
   * @returns {object[]} The unchanged messages, if within the estimated budget.
   */
  _enforcePayloadLimit(messages) {
    this._validateContextPayload({ messages });
    return messages;
  }

  /**
   * Applies the same estimator to the actual request, including extra fields.
   * @param {object} payload - Complete provider payload.
   */
  _validateContextPayload(payload) {
    const settings = this._contextSettings();
    if (!settings.limit) return;
    const { messages, contents, ...extra } = payload;
    // Separate system fields are physically sent in addition to the messages.
    const input = estimateContextTokens(messages || contents || [], "", settings.charsPerToken, extra);
    if (input + settings.output + 500 > settings.limit) {
      throw new Error("CONTEXT_BUDGET: formatted payload exceeds the estimated budget; no request sent and no input truncated");
    }
  }

  /**
   * Estimates usage with the same normalization and reserve as request preparation.
   * @returns {{input: number, output: number, overhead: number, limit: number}} Usage.
   */
  getContextUsage() {
    const settings = this._contextSettings();
    return {
      input: estimateContextTokens(this.getHistory(), this.systemInstruction, settings.charsPerToken),
      output: settings.output, overhead: 500, limit: settings.limit,
    };
  }

  /**
   * Sends a request with atomic history rollback and coherent turn identifiers.
   * @param {string|object|Array} message - The content to send.
   * @param {string} [role] - Sender role.
   * @param {object} [options] - Provider options, including cancellation.
   * @returns {Promise<string>} Model response.
   */
  async sendMessage(message, role = "user", options = {}) {
    if (this.#pendingEntries) throw new Error("A context request is already active");
    const history = this.getHistory();
    const before = structuredClone(history);
    const ownsTurn = !this.#contextTurn;
    if (ownsTurn) this.beginContextTurn();
    this.#pendingEntries = new Set(history);
    try {
      const response = await this._sendMessage(message, role, options);
      this._tagContextEntries();
      return response;
    } catch (error) {
      const current = this.getHistory();
      current.splice(0, current.length, ...before);
      throw error;
    } finally {
      this.#pendingEntries = null;
      if (ownsTurn) this.endContextTurn();
    }
  }

  /**
   * Provider implementation, called by the common history transaction.
   * @param {string|object|Array} _message - Content.
   * @param {string} [_role] - Sender role.
   * @param {object} [_options] - Provider options.
   * @returns {Promise<string>} Model response.
   */
  async _sendMessage(_message, _role = "user", _options = {}) {
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
   * @abstract
   * @returns {Array} The conversation messages, including the system entry when used.
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
