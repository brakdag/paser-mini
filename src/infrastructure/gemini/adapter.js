import axios from "axios";
import logger from "../../core/logger.js";
import BaseAdapter from "../baseAdapter.js";
import IRCFormatter from "../../utils/ircFormatter.js";
import RetryHandler from "../../utils/retryHandler.js";
import {
  GeminiSafetyError,
  GeminiEmptyResponseError,
} from "../../core/exceptions.js";

/**
 * Adapter for the Google Gemini API, handling communication, rate limiting, and history.
 * @augments BaseAdapter
 */
class GeminiAdapter extends BaseAdapter {
  /**
   * Initializes the GeminiAdapter with necessary dependencies and configurations.
   * @param {object} ui - The UI interface for displaying information.
   * @param {object} configManager - The configuration manager.
   * @param {string} [userNickname] - The nickname of the user.
   * @param {string} [agentNickname] - The nickname of the agent.
   */
  constructor(
    ui,
    configManager,
    userNickname = "user",
    agentNickname = "assistant",
  ) {
    super(ui, configManager, userNickname, agentNickname);
    this.apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    this.history = [];
    this.currentModel = "models/gemma-4-26b-a4b-it";
    this.systemInstruction = null;
    this.temperature = 0.7;
    this.lastPayload = null;
    this.renderingMode = "IRC";
    this.lastRequestTime = 0;

    this.client = axios.create({
      timeout: 600000,
    });
    this.retryHandler = new RetryHandler();
    this.recoverableErrors = [
      "Empty response from Gemini",
      "No response candidates returned",
      "No content parts returned",
      "Response blocked by safety filters.",
    ];
  }

  /**
   * Sets the rendering mode for the adapter.
   * @param {string} mode - The rendering mode to use.
   */
  setRenderingMode(mode) {
    this.renderingMode = mode;
  }

  /**
   * Configures the chat session with a specific model, system instruction, and temperature.
   * @param {string} modelName - The name of the model to use.
   * @param {string} systemInstruction - The system instruction for the model.
   * @param {number} [temperature] - The temperature for generation.
   */
  startChat(modelName, systemInstruction, temperature = 0.7) {
    this.currentModel = modelName || this.currentModel;
    this.systemInstruction = systemInstruction;
    this.temperature = temperature;
  }

  /**
   * Builds the final payload for the Gemini API request based on conversation history.
   * @private
   * @returns {object} The constructed payload.
   */
  _buildPayload() {
    const contents = this.history.map((entry) => {
      const role = entry.role === "server" ? "user" : entry.role;

      const parts = entry.parts.map((part) => {
        if (part && typeof part === "object" && part.inline_data) {
          return part;
        }

        let textContent;
        if (typeof part === "object" && part.text) {
          textContent = part.text;
        } else if (typeof part === "string") {
          textContent = part;
        } else {
          textContent = JSON.stringify(part);
        }

        const formattedText = this.formatTextForPayload(
          role,
          textContent,
          entry.timestamp,
        );

        return {
          text: formattedText,
        };
      });

      return { role, parts };
    });

    const payload = {
      contents,
      generationConfig: {
        temperature: this.temperature,
        top_p: 0.95,
        top_k: 64,
      },
    };

    if (this.systemInstruction) {
      payload.systemInstruction = {
        parts: [{ text: this.systemInstruction }],
      };
    }

    return payload;
  }

  /**
   * Removes thought/reasoning tags and timestamps from the model response.
   * @private
   * @param {string} text - The raw text to filter.
   * @returns {string} The cleaned text.
   */
  _filterThoughts(text) {
    if (!text) return "";
    let cleaned = text.replace(/<(thought|reasoning)>[\s\S]*?<\/\1>/gi, "");
    cleaned = cleaned.replace(/^(\[\d{2}:\d{2}:\d{2}\]\s*<[^>]+>\s*)+/g, "");
    return cleaned.trim();
  }

  /**
   * Converts various content types into Gemini API compatible parts.
   * @private
   * @param {string|Array|object} content - The content to convert.
   * @returns {Array<object>} An array of Gemini API parts.
   */
  _createParts(content) {
    if (Array.isArray(content)) {
      return content.flatMap((item) => {
        if (typeof item === "string") return [{ text: item }];
        if (item && typeof item === "object" && item.mime_type && item.data) {
          return [
            { inline_data: { mime_type: item.mime_type, data: item.data } },
            { text: `Image resolution: ${item.resolution || "unknown"}` },
          ];
        }
        return [{ text: item === undefined ? "" : JSON.stringify(item) }];
      });
    }
    if (typeof content === "string") {
      return [{ text: content }];
    }
    if (
      content &&
      typeof content === "object" &&
      content.mime_type &&
      content.data
    ) {
      return [
        { inline_data: { mime_type: content.mime_type, data: content.data } },
        { text: `Image resolution: ${content.resolution || "unknown"}` },
      ];
    }
    return [{ text: content === undefined ? "" : JSON.stringify(content) }];
  }

  /**
   * Records a message in the conversation history.
   * @private
   * @param {string} role - The role of the message sender.
   * @param {string|Array|object} content - The content of the message.
   * @param {string|null} [timestamp] - The timestamp of the message.
   */
  _recordMessage(role, content, timestamp = null) {
    const ts = timestamp || IRCFormatter.getTimestamp();
    const parts = this._createParts(content);

    this.history.push({
      role,
      parts,
      timestamp: ts,
    });
  }

  /**
   * Sends a message to the Gemini API and returns the response.
   * @param {string|Array|object} message - The message to send.
   * @param {string} [role] - The role of the sender.
   * @returns {Promise<string>} The processed response text.
   * @throws {Error} If the API request fails.
   */
  async sendMessage(message, role = "user") {
    await this._applyRateLimit();
    this._recordMessage(role, message);
    this._enforceContextLimit(); // Apply strict context boundary before API call
    const historyLengthBefore = this.history.length;

    /**
     * Executes the API request with retry logic.
     * @returns {Promise<string>} The processed response text.
     */
    try {
      return await this.retryHandler.execute(async () => {
        try {
          const payload = this._buildPayload();
          this.lastPayload = payload;

          const modelName = this.currentModel.replace(/^models\//, "");
          const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${this.apiKey}`;

          const response = await this.client.post(url, payload);
          return this._processApiResponse(response.data);
        } catch (error) {
          throw this._wrapApiError(error);
        }
      }, {
      recoverableErrors: this.recoverableErrors,
      /**
       * @param {number} attempt - The current attempt number.
       * @param {Error} error - The error that triggered the retry.
       * @param {string} formattedDelay - The formatted delay string.
       */
      onRetry: (attempt, error, formattedDelay) => {
        logger.warn(`[GeminiAdapter] Retrying in ${formattedDelay}... (${attempt}/15) due to: ${error.message}`);
        if (this.ui && this.ui.displayInfo) {
          this.ui.displayInfo(`Reintentando Gemini en ${formattedDelay}... (${attempt}/15) | Error: ${error.message}`);
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
   * Processes the raw API response and extracts the text content.
   * @private
   * @param {object} data - The raw response data from the API.
   * @returns {string} The filtered response text.
   * @throws {GeminiEmptyResponseError|GeminiSafetyError} If the response is invalid or blocked.
   */
  _processApiResponse(data) {
    const { candidates } = data;
    if (!candidates || candidates.length === 0) {
      throw new GeminiEmptyResponseError(
        "No response candidates returned (possible safety block).",
      );
    }

    const candidate = candidates[0];
    if (candidate.finishReason === "SAFETY") {
      throw new GeminiSafetyError("Response blocked by safety filters.");
    }

    const { content } = candidate;
    if (!content || !content.parts || content.parts.length === 0) {
      throw new GeminiEmptyResponseError("No content parts returned.");
    }

    let textContent = content.parts.map((p) => p.text).join("");
    textContent = this._filterThoughts(textContent);

    if (textContent) {
      this._recordMessage("model", textContent);
      return textContent;
    }

    throw new GeminiEmptyResponseError("Empty response");
  }

  /**
   * Wraps API errors into a standardized APIError format.
   * @private
   * @param {Error} error - The original error.
   * @returns {Error} The wrapped APIError.
   */
  _wrapApiError(error) {
    const errorMsg = error.response?.data?.error?.message || error.message;
    const wrappedError = new Error(errorMsg);
    wrappedError.name = "APIError";
    wrappedError.response = error.response;
    wrappedError.code = error.code;
    return wrappedError;
  }

  /**
   * Manually injects a message into the conversation history.
   * @param {string} role - The role of the message sender.
   * @param {string|Array|object} content - The content of the message.
   * @param {string|null} [timestamp] - The timestamp of the message.
   */
  injectMessage(role, content, timestamp = null) {
    this._recordMessage(role, content, timestamp);
  }

  /**
   * Resets the conversation history.
   * @param {Array|null} [historyOverride] - Optional new history to initialize with.
   */
  hardReset(historyOverride = null) {
    this.history = historyOverride || [];
  }

  /**
   * Retrieves the current conversation history.
   * @returns {Array} The conversation history.
   */
  getHistory() {
    return this.history;
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
   * Estimates the token count based on character length heuristic.
   * Accounts for the 'parts' array structure specific to the Gemini API.
   * @param {string} systemInstruction - The system instruction text.
   * @param {Array} history - The conversation history.
   * @returns {number} The estimated token count.
   */
  countTokens(systemInstruction, history) {
    const CHARS_PER_TOKEN = 3.5;
    const systemChars = systemInstruction?.length || 0;
    const historyChars = history.reduce((acc, msg) => {
      const partsLength = (msg.parts || []).reduce((partAcc, part) => {
        if (typeof part.text === "string") {
          return partAcc + part.text.length;
        }
        return partAcc;
      }, 0);
      return acc + partsLength;
    }, 0);
    return Math.ceil((systemChars + historyChars) / CHARS_PER_TOKEN);
  }

  /**
   * Fetches the list of available models from the Gemini API.
   * @returns {Promise<string[]>} A list of available model names.
   */
  async getAvailableModels() {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${this.apiKey}`;
      const response = await this.client.get(url);
      const { data } = response;
      return data.models.map((m) => m.name);
    } catch (error) {
      logger.error(`Error fetching models: ${error.message}`);
      return ["models/gemini-2.0-flash", "models/gemini-1.5-flash"];
    }
  }

  /**
   * Checks if a specific model is available and responsive.
   * @param {string} modelName - The name of the model to check.
   * @returns {Promise<boolean>} True if available, false otherwise.
   */
  async checkAvailability(modelName) {
    try {
      const name = modelName.replace(/^models\//, "");
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${name}:generateContent?key=${this.apiKey}`;
      const payload = { contents: [{ role: "user", parts: [{ text: "hi" }] }] };
      await this.client.post(url, payload);
      return true;
    } catch (error) {
      const status = error.response?.status;
      if (status === 404 || status === 400) return false;
      return true;
    }
  }
}

export default GeminiAdapter;
