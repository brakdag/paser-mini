import axios from "axios";
import BaseAdapter from "../baseAdapter.js";
import RetryHandler from "../../utils/retryHandler.js";
import { appendChatMessage, resetChatHistory, sendChatCompletion } from "../compatibleChat.js";

/** Configurable chat-completions transport, including unauthenticated local servers. */
export default class CompatibleAdapter extends BaseAdapter {
  systemInstructionInHistory = true;

  /**
   * @param {object} options - Adapter dependencies.
   * @param {object} options.ui - UI.
   * @param {object} options.configManager - Configuration.
   * @param {string} [options.userNickname] - User identity.
   * @param {string} [options.agentNickname] - Assistant identity.
   */
  constructor(options) {
    super(options);
    const base = options.configManager.get("compatible_base_url");
    let url;
    try { url = new URL(base); } catch { throw new Error("compatible_base_url must be an HTTP(S) URL"); }
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
      throw new Error("compatible_base_url must be HTTP(S), without credentials, query or fragment");
    }
    const model = options.configManager.get("model_name");
    if (typeof model !== "string" || !model.trim()) throw new Error("COMPATIBLE requires model_name");
    const keyEnv = options.configManager.get("compatible_api_key_env");
    if (keyEnv != null && (typeof keyEnv !== "string" || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(keyEnv))) {
      throw new Error("compatible_api_key_env must name an environment variable");
    }
    const key = process.env[keyEnv || "CUSTOM_API_KEY"];
    if (keyEnv && !key) throw new Error("Configured compatible API credential is missing");
    if (key != null && (typeof key !== "string" || /[\r\n]/.test(key))) {
      throw new Error("Compatible API key must be a single-line string");
    }
    this.client = axios.create({
      baseURL: url.href.replace(/\/$/, ""), timeout: 600000,
      headers: { "Content-Type": "application/json", ...(key ? { Authorization: `Bearer ${key}` } : {}) },
    });
    this.currentModel = model;
    this.history = [];
    this.lastPayload = null;
    this.temperature = 0.7;
    this.systemInstruction = "";
    this.retryHandler = new RetryHandler();
    this.recoverableErrors = ["Empty response from Compatible"];
  }

  /**
   * @param {string} model - Explicit model.
   * @param {string} instruction - System prompt.
   * @param {number} [temperature] - Sampling temperature.
   */
  startChat(model, instruction, temperature = 0.7) {
    this.currentModel = model;
    this.temperature = temperature;
    this.updateSystemInstruction(instruction);
  }

  /**
   * @param {string|object|Array} message - Content.
   * @param {string} [role] - Sender.
   * @param {object} [options] - Request options.
   * @param {AbortSignal} [options.signal] - Cancellation.
   * @param {import("../../utils/requestBudget.js").default} [options.budget] - Deadline.
   * @returns {Promise<string>} Reply.
   */
  _sendMessage(message, role = "user", options = {}) {
    return sendChatCompletion(this, message, role, options);
  }

  /**
   * @param {string} role - Sender.
   * @param {string|object|Array} content - Content.
   * @param {string|null} [timestamp] - Timestamp.
   */
  injectMessage(role, content, timestamp = null) { appendChatMessage(this, role, content, timestamp); }

  /** @returns {Array} Mutable history. */
  getHistory() { return this.history; }

  /** Removes the last entry. */
  popLastMessage() { this.history.pop(); }

  /** @param {Array|null} [history] - Replacement history. */
  hardReset(history = null) { resetChatHistory(this, history); }

  /** @returns {Promise<string[]>} Explicitly configured model. */
  async getAvailableModels() { return [this.currentModel]; }
}
