import ConversationState from "../conversationState.js";
import NvidiaRestClient from "../nvidia/restClient.js";
import logger from "../../core/logger.js";
import BaseAdapter from "../baseAdapter.js";
import RetryHandler from "../../utils/retryHandler.js";

const DEFAULT_MODEL = "minimaxai/minimax-m3";
const DEFAULT_TEMPERATURE = 0.3;
const M3_TIMEOUT = 900000; // 15 minutos - el M3 en NVIDIA sufre colas largas

/**
 * Dedicated adapter for the MiniMax M3 model on NVIDIA NIM infrastructure.
 *
 * The M3 is an Agentic MoE model hosted on NVIDIA's fragile endpoint.
 * It requires a purged payload (no thinking/reasoning parameters),
 * extended timeouts, and explicit handling of degraded responses.
 *
 * This adapter exists as an isolated module to prevent the fragility
 * of the M3 endpoint from contaminating the standard NVIDIA adapter.
 */
class NvidiaMiniMaxAdapter extends BaseAdapter {
  /**
   * @param {object} params - Constructor parameters.
   * @param {object} params.ui - The user interface handler.
   * @param {object} params.configManager - The system configuration manager.
   * @param {string} [params.userNickname] - The identifier for the human user.
   * @param {string} [params.agentNickname] - The identifier for the AI agent.
   */
  constructor({
    ui,
    configManager,
    userNickname = "user",
    agentNickname = "assistant",
  }) {
    super({ ui, configManager, userNickname, agentNickname });
    this.state = new ConversationState(userNickname, agentNickname);
    this.restClient = new NvidiaRestClient(configManager);
    this.currentModel = DEFAULT_MODEL;
    this.systemInstruction = "";
    this.temperature = DEFAULT_TEMPERATURE;
    this.lastPayload = null;
    this.lastReasoning = null;
    this.retryHandler = new RetryHandler();
    this.recoverableErrors = [
      "NVIDIA M3 endpoint returned an empty or degraded response.",
      "ETIMEDOUT",
      "ECONNRESET",
    ];
  }

  /**
   * Configures the chat session for the M3 model.
   * @param {string} modelName - The specific model identifier.
   * @param {string} systemInstruction - The system-level prompt.
   * @param {number} temperature - The sampling temperature.
   */
  startChat(modelName, systemInstruction, temperature = DEFAULT_TEMPERATURE) {
    this.currentModel = modelName || this.currentModel;
    this.systemInstruction = systemInstruction;
    this.temperature = temperature;
    logger.info("NvidiaMiniMaxAdapter: Chat started", {
      model: this.currentModel,
      temperature,
    });
  }

  /**
   * Sends a message and returns the filtered response.
   * @param {string} message - The text content to be sent.
   * @param {string} role - The role of the message sender.
   * @returns {Promise<string>} The processed response text.
   */
  async sendMessage(message, role = "user") {
    this.state.addMessage(role, message);
    this._enforceContextLimit(); // Apply strict context boundary before API call
    const historyLengthBefore = this.state.getRawHistory().length;

    const payload = this._preparePayload();
    this.lastPayload = payload;

    /**
     * Executes the API request with retry logic.
     * @returns {Promise<string>} The processed response text.
     */
    try {
      return await this.retryHandler.execute(async () => {
      try {
        const data = await this.restClient.chatCompletions(payload, false, M3_TIMEOUT);
        return this._handleResponse(data);
      } catch (e) {
        throw this._handleError(e);
      }
    }, {
      recoverableErrors: this.recoverableErrors,
      /**
       * @param {number} attempt - The current attempt number.
       * @param {Error} error - The error that triggered the retry.
       * @param {string} formattedDelay - The formatted delay string.
       */
      onRetry: (attempt, error, formattedDelay) => {
        logger.warn(`[NvidiaMiniMaxAdapter] Retrying in ${formattedDelay}... (${attempt}/15) due to: ${error.message}`);
        if (this.ui && this.ui.displayInfo) {
          this.ui.displayInfo(`Reintentando NVIDIA M3 en ${formattedDelay}... (${attempt}/15) | Error: ${error.message}`);
        }
      }
    });
    } catch (error) {
      if (this.state.getRawHistory().length === historyLengthBefore) {
        this.state.popLastMessage();
      }
      throw error;
    }
  }

  /**
   * Constructs a purged request payload specifically for the M3 model.
   *
   * The M3 on NVIDIA NIM rejects any 'thinking', 'reasoning_effort',
   * or extended parameters. Only the absolute base schema is permitted.
   * @returns {object} The purged request payload.
   */
  _preparePayload() {
    const history = this.state.getRawHistory();
    const messages = [];

    if (this.systemInstruction) {
      messages.push({ role: "system", content: this.systemInstruction });
    }

    history.forEach((m) => {
      const text = typeof m.text === "string" ? m.text : JSON.stringify(m.text);
      messages.push({
        role: m.role === "model" ? "assistant" : m.role,
        content: this.formatTextForPayload(m.role, text, m.timestamp),
      });
    });

    return {
      model: this.currentModel,
      messages,
      temperature: this.temperature,
      stream: false, // Forzar no-stream hasta que el endpoint se estabilice
      max_tokens: 8192, // El M3 requiere un limite explicito para evitar respuestas truncadas
    };
  }

  /**
   * Processes the API response with explicit degradation handling.
   *
   * NVIDIA may return HTTP 200 with an empty body when the M3 service
   * is degraded. This method intercepts such responses and throws
   * a controlled exception instead of propagating empty strings.
   * @param {object} data - The raw response data from the API.
   * @returns {string} The filtered response content.
   * @throws {Error} If the response is empty or degraded.
   */
  _handleResponse(data) {
    if (!data || !data.choices || data.choices.length === 0) {
      logger.error("NvidiaMiniMaxAdapter: Degraded response - empty choices", {
        hasData: !!data,
        choicesLength: data?.choices?.length ?? 0,
      });
      throw this._createDegradedError(data);
    }

    const choice = data.choices[0];
    const rawContent = choice.message?.content || "";
    const reasoningContent = choice.message?.reasoning_content || null;

    if (reasoningContent) {
      this.lastReasoning = reasoningContent;
      logger.info("NvidiaMiniMaxAdapter: Reasoning content isolated", {
        reasoningLength: reasoningContent.length,
      });
    }

    const content = this._filterThoughts(rawContent);

    if (!content) {
      logger.error("NvidiaMiniMaxAdapter: Empty content after filtering", {
        rawLength: rawContent.length,
      });
      throw this._createDegradedError(data);
    }

    logger.info("NvidiaMiniMaxAdapter: Response received", {
      length: content.length,
      hasReasoning: !!reasoningContent,
    });

    this.state.addMessage("model", content);
    return content;
  }

  /**
   * Creates a standardized error for degraded/empty responses.
   * @param {object} data - The raw response data.
   * @returns {Error} A standardized ServiceDegradedError.
   */
  _createDegradedError(data) {
    const error = new Error(
      "NVIDIA M3 endpoint returned an empty or degraded response.",
    );
    error.name = "ServiceDegradedError";
    error.response = { status: 503, data };
    return error;
  }

  /**
   * Standardizes API errors with M3-specific context.
   * @param {Error} e - The caught error object.
   * @throws {Error} A standardized APIError.
   */
  _handleError(e) {
    const errorMsg = e.response?.data?.error?.message || e.message;
    const statusCode = e.response?.status;

    logger.error("NvidiaMiniMaxAdapter: Request failed", {
      error: errorMsg,
      status: statusCode,
      isDegraded: e.name === "ServiceDegradedError",
    });

    const error = new Error(errorMsg);
    error.name = e.name === "ServiceDegradedError" ? "ServiceDegradedError" : "APIError";
    error.response = e.response;
    throw error;
  }

  /**
   * Removes internal reasoning tags from the model response.
   * The M3 may interleave <thought> or <reasoning> tags.
   * @param {string} text - The raw text to be filtered.
   * @returns {string} The cleaned text.
   */
  _filterThoughts(text) {
    if (!text) return "";
    let cleaned = text.replace(/<(thought|reasoning)>[\s\S]*?<\/\1>/gi, "");
    return cleaned.trim();
  }

  /**
   * Manually injects a message into the conversation state.
   * @param {string} role - The role of the message sender.
   * @param {string} content - The message content to inject.
   * @param {number|null} timestamp - The optional message timestamp.
   */
  injectMessage(role, content, timestamp = null) {
    this.state.addMessage(role, content, timestamp);
  }

  /**
   * Updates the state rendering mode.
   * @param {string} mode - The rendering mode for the state.
   */
  setRenderingMode(mode) {
    super.setRenderingMode(mode);
    this.state.setRenderingMode(mode);
  }

  /**
   * Resets the conversation state.
   * @param {Array|null} historyOverride - Optional history to apply during reset.
   */
  hardReset(historyOverride = null) {
    this.state.hardReset(historyOverride);
    this.lastReasoning = null;
    logger.info("NvidiaMiniMaxAdapter: State hard reset");
  }

  /**
   * Retrieves the raw message history.
   * @returns {Array} The current raw message history.
   */
  getHistory() {
    return this.state.getRawHistory();
  }

  /**
   * Removes the last message from the state.
   */
  popLastMessage() {
    this.state.popLastMessage();
  }

  /**
   * Updates the user and agent nicknames in state.
   * @param {string} userNickname - The new identifier for the human user.
   * @param {string} agentNickname - The new identifier for the AI agent.
   */
  updateNicknames(userNickname, agentNickname) {
    this.state.userNickname = userNickname;
    this.state.agentNickname = agentNickname;
  }

  /**
   * Fetches available models from the Nvidia API.
   * @returns {Promise<string[]>} A list of available model identifiers.
   */
  async getAvailableModels() {
    try {
      const data = await this.restClient.get("models");
      const models = data.data?.map((m) => m.id) || [];
      if (models.length === 0) throw new Error("Empty model list from API");
      logger.info("NvidiaMiniMaxAdapter: Models fetched", { count: models.length });
      return models;
    } catch (e) {
      logger.error("NvidiaMiniMaxAdapter: Failed to fetch models", {
        error: e.message,
      });
      return [DEFAULT_MODEL];
    }
  }

  /**
   * Checks if the M3 model is responsive.
   * Uses a longer timeout than standard models due to queue degradation.
   * @param {string} modelName - The model identifier to check.
   * @returns {Promise<boolean>} True if the model is available or times out.
   */
  async checkAvailability(modelName) {
    try {
      const payload = {
        model: modelName || DEFAULT_MODEL,
        messages: [{ role: "user", content: "ping" }],
        max_tokens: 1,
        temperature: 0.1,
      };
      await this.restClient.chatCompletions(payload, false, 30000);
      return true;
    } catch (e) {
      if (e.response?.status === 404) {
        logger.warn("NvidiaMiniMaxAdapter: Model not found (404)", { modelName });
        return false;
      }
      if (
        e.code === "ECONNABORTED" ||
        e.message?.toLowerCase().includes("timeout")
      ) {
        logger.warn("NvidiaMiniMaxAdapter: Check timed out, assuming available", {
          modelName,
        });
        return true;
      }
      logger.error("NvidiaMiniMaxAdapter: Availability check failed", {
        modelName,
        error: e.message,
      });
      return false;
    }
  }

  /**
   * Estimates token count based on M3 heuristic.
   * The M3 uses a different tokenizer than Llama-3.
   * @param {string} systemInstruction - The system prompt text.
   * @param {Array} history - The message history array.
   * @returns {number} The estimated token count.
   */
  countTokens(systemInstruction, history) {
    const systemChars = systemInstruction?.length || 0;
    const historyChars = history.reduce(
      (acc, msg) => acc + (msg.text?.length || 0),
      0,
    );
    // M3 heuristic: ~3 characters per token for mixed content
    return Math.ceil((systemChars + historyChars) / 3);
  }

  /**
   * Retrieves the last isolated reasoning content if available.
   * @returns {string|null} The reasoning text or null.
   */
  getLastReasoning() {
    return this.lastReasoning;
  }
}

export default NvidiaMiniMaxAdapter;