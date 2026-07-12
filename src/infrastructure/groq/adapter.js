import axios from "axios";
import BaseAdapter from "../baseAdapter.js";
import logger from "../../core/logger.js";
import RetryHandler from "../../utils/retryHandler.js";

const TIMESTAMP_FORMAT = "en-GB";
const TIMESTAMP_OPTIONS = { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false };
const BASE_URL = "https://api.groq.com/openai/v1";
const DEFAULT_MODEL = "llama3-8b-8192";
const DEFAULT_TEMPERATURE = 0.7;
const CHARS_PER_TOKEN = 3.5;

/**
 * Generates a timestamp string in HH:MM:SS format.
 * @returns {string} The formatted timestamp.
 */
function getTimestamp() {
  return new Date().toLocaleTimeString(TIMESTAMP_FORMAT, TIMESTAMP_OPTIONS);
}

/**
 * Normalizes the role of a message sender to the API-compatible role.
 * @param {string} role - The original role.
 * @param {string} userNickname - The user's nickname.
 * @param {string} agentNickname - The agent's nickname.
 * @returns {string} The normalized role.
 */
function normalizeRole(role, userNickname, agentNickname) {
  if (role === userNickname) return "user";
  if (role === agentNickname || role === "model") return "assistant";
  if (role === "server") return "user";
  return role;
}

/**
 * Normalizes message content for the API, handling objects, arrays, and thought filtering.
 * @param {string|object|Array} content - The raw content.
 * @param {string} apiRole - The normalized API role.
 * @returns {string|Array} The normalized content.
 */
function normalizeContent(content, apiRole) {
  let finalContent = content;

  if (content && typeof content === "object" && content.mime_type && content.data) {
    finalContent = [
      { type: "text", text: `Image resolution: ${content.resolution || "unknown"}` },
      { type: "image_url", image_url: { url: `data:${content.mime_type};base64,${content.data}` } },
    ];
  } else if (Array.isArray(content)) {
    finalContent = content.join("\n");
  }

  if (typeof finalContent === "string" && apiRole === "assistant") {
    finalContent = finalContent.replace(/<thought>[\s\S]*?<\/thought>/gi, "").trim();
  }

  return finalContent;
}

/**
 * Adapter for integrating Groq AI models into the system.
 */
class GroqAdapter extends BaseAdapter {
  /**
   * Initializes the Groq adapter with API client and retry logic.
   * @param {object} params - The constructor parameters.
   * @param {object} params.ui - The UI interface.
   * @param {object} params.configManager - The configuration manager.
   * @param {string} [params.userNickname] - The user's nickname.
   * @param {string} [params.agentNickname] - The agent's nickname.
   */
  constructor({ ui, configManager, userNickname = "user", agentNickname = "assistant" }) {
    super({ ui, configManager, userNickname, agentNickname });
    this.apiKey = process.env.GROQ_API_KEY;
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
    this.recoverableErrors = ["Empty response from Groq"];
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
        timestamp: getTimestamp(),
      });
    }
  }

  /**
   * Sends a message to the Groq API and returns the response.
   * @param {string} message - The message content to send.
   * @param {string} [role] - The role of the sender.
   * @returns {Promise<string>} The response text from the API.
   * @throws {Error} If the response is empty or the request fails.
   */
  async sendMessage(message, role = "user") {
    this.injectMessage(role, message, getTimestamp());
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

    /**
     * Executes the API request with retry logic.
     * @returns {Promise<string>} The response text.
     */
    try {
      return await this.retryHandler.execute(async () => {
      try {
        const response = await this.client.post("/chat/completions", payload);
        const textContent = response.data.choices[0].message.content;

        if (!textContent) {
          throw new Error("Empty response from Groq");
        }

        this.injectMessage("assistant", textContent, getTimestamp());
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
       * @param {number} attempt - The current attempt number.
       * @param {Error} error - The error that triggered the retry.
       * @param {string} formattedDelay - The formatted delay string.
       */
      onRetry: (attempt, error, formattedDelay) => {
        logger.warn(`[GroqAdapter] Retrying in ${formattedDelay}... (${attempt}/15) due to: ${error.message}`);
        if (this.ui && this.ui.displayInfo) {
          this.ui.displayInfo(`Reintentando Groq en ${formattedDelay}... (${attempt}/15) | Error: ${error.message}`);
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
    const apiRole = normalizeRole(role, this.userNickname, this.agentNickname);
    const finalContent = normalizeContent(content, apiRole);

    this.history.push({
      role: apiRole,
      content: finalContent,
      timestamp: timestamp || getTimestamp(),
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
    logger.info("[GroqAdapter] History hard reset");
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
    const systemChars = systemInstruction?.length || 0;
    const historyChars = history.reduce((acc, msg) => {
      const content = msg.content || msg.text || "";
      return acc + (typeof content === "string" ? content.length : JSON.stringify(content).length);
    }, 0);
    return Math.ceil((systemChars + historyChars) / CHARS_PER_TOKEN);
  }

  /**
   * Fetches the list of available models from the Groq API.
   * @returns {Promise<string[]>} A list of available model identifiers.
   */
  async getAvailableModels() {
    try {
      const response = await this.client.get("/models");
      return response.data.data.map((m) => m.id).sort();
    } catch (error) {
      logger.error(`[GroqAdapter] Error fetching models: ${error.message}`);
      return ["llama3-8b-8192", "llama3-70b-8192", "mixtral-8x7b-32768"];
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
      logger.warn(`[GroqAdapter] Model check failed for ${modelName}: ${error.message}`);
      return false;
    }
  }
}

export default GroqAdapter;
