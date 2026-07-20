import axios from "axios";
import BaseAdapter from "../baseAdapter.js";
import logger from "../../core/logger.js";
import IRCFormatter from "../../utils/ircFormatter.js";
import RetryHandler from "../../utils/retryHandler.js";
import { normalizeRole, normalizeContent } from "../historyNormalizer.js";

const BASE_URL = "https://api.cohere.com/v2";

/**
 * Adapter for the Cohere AI API, providing chat capabilities and history management.
 * @augments BaseAdapter
 */
class CohereAdapter extends BaseAdapter {
  /**
   * @param {object} params - The constructor parameters.
   * @param {object} params.ui - The UI interface.
   * @param {object} params.configManager - The configuration manager.
   * @param {string} [params.userNickname] - The user's nickname.
   * @param {string} [params.agentNickname] - The agent's nickname.
   */
  constructor({ ui, configManager, userNickname = "user", agentNickname = "assistant" }) {
    super({ ui, configManager, userNickname, agentNickname });
    this.apiKey = process.env.COHERE_API_KEY;
    this.history = [];
    this.currentModel = "command-r-plus";
    this.systemInstruction = null;
    this.temperature = 0.7;

    this._configureClient();
    this.retryHandler = new RetryHandler();
    this.recoverableErrors = ["Empty response from Cohere"];
    this.lastPayload = null; // Propiedad expuesta para depuración (comando /s)
  }

  /**
   * Configures the axios client with base URL, timeout, and headers.
   * @private
   */
  _configureClient() {
    this.client = axios.create({
      baseURL: BASE_URL,
      timeout: 600000,
      headers: {
        "Authorization": `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
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
    logger.info(`[CohereAdapter] startChat received systemInstruction. Length: ${systemInstruction?.length || 0} chars`);
  }

  /**
   * Sends a message to the Cohere API and returns the response text.
   * @param {string|object|Array} message - The message content to send.
   * @param {string} [role] - The role of the sender.
   * @returns {Promise<string>} The response text from the AI.
   * @throws {Error} If the API request fails.
   */
  async sendMessage(message, role = "user") {
    const timestamp = IRCFormatter.getTimestamp();
    this.injectMessage(role, message, timestamp);
    this._enforceContextLimit();
    const historyLengthBefore = this.history.length;

    const payload = this._preparePayload();

    await this._applyRateLimit();

    try {
      return await this.retryHandler.execute(async () => {
        try {
          // Guardamos el payload estáticamente para depuración y observabilidad
          this.lastPayload = payload;
          logger.info(`[CohereAdapter] Requesting: ${this.client.defaults.baseURL}/v2/chat`);
          logger.info(`[CohereAdapter] Payload: ${JSON.stringify(payload)}`);

          const response = await this.client.post("/chat", payload);
          return this._handleResponse(response);
        } catch (error) {
          throw this._handleApiError(error, payload);
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
          logger.warn(`[CohereAdapter] Retrying in ${formattedDelay}... (${attempt}/15) due to: ${error.message}`);
          if (this.ui && this.ui.displayInfo) {
            this.ui.displayInfo(`Retrying Cohere in ${formattedDelay}... (${attempt}/15) | Error: ${error.message}`);
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
   * Prepares the payload for the Cohere /chat endpoint.
   * @private
   * @returns {object} The formatted payload.
   */
  _preparePayload() {
    const messages = [];

    // En la v2 de Cohere, el system prompt se envía como el primer mensaje con rol 'system'.
    if (this.systemInstruction) {
      messages.push({
        role: 'system',
        content: this.systemInstruction
      });
    }

    // Mapeamos todo el historial al formato estándar exigido por la v2.
    const mappedHistory = this.history
      .filter(msg => msg.content && String(msg.content).trim()) // Purgamos posibles vacíos que rompen la semántica
      .map(msg => ({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: this.formatTextForPayload(msg.role, msg.content, msg.timestamp)
      }));

    // Cohere arroja 422 'No valid response generated' si la secuencia de roles no es perfectamente alternante.
    // Sanitizamos la estructura mediante reducción funcional pura para garantizar una alternancia inmaculada.
    const { sanitizedHistory } = mappedHistory.reduce((acc, msg) => {
      if (msg.role === acc.expectedRole) {
        acc.sanitizedHistory.push(msg);
        acc.expectedRole = acc.expectedRole === 'user' ? 'assistant' : 'user';
      } else {
        // Si se rompe la secuencia, fusionamos el texto en el último mensaje válido para no perder contexto.
        const lastMsg = acc.sanitizedHistory[acc.sanitizedHistory.length - 1];
        if (lastMsg) {
          lastMsg.content += `\n${msg.content}`;
        } else {
          // Caso extremo: el historial arranca con 'assistant'. Forzamos su inclusión cambiando la expectativa.
          acc.sanitizedHistory.push(msg);
          acc.expectedRole = 'user';
        }
      }
      return acc;
    }, { sanitizedHistory: [], expectedRole: 'user' });

    const finalMessages = [...messages, ...sanitizedHistory];

    return {
      model: this.currentModel,
      messages: finalMessages,
      temperature: this.temperature,
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
    // En la API v2, la respuesta llega en un arreglo de contenidos dentro de 'message.content'.
    const contentParts = response.data?.message?.content;
    if (Array.isArray(contentParts) && contentParts.length > 0) {
      const textContent = contentParts.map(part => part.text || '').join('\n');
      
      if (textContent.trim()) {
        const msgTimestamp = IRCFormatter.getTimestamp();
        this.injectMessage("assistant", textContent, msgTimestamp);
        return textContent;
      }
    }

    throw new Error("Empty response from Cohere");
  }

  /**
   * Formats an API error into a standardized Error object.
   * @param {Error} error - The caught error object.
   * @param {object} payload - The payload sent to the API when the error occurred.
   * @private
   * @returns {Error} A formatted Error object with name "APIError".
   */
  _handleApiError(error, payload) {
    const errorData = error.response?.data;
    const errorMsg = errorData?.message || error.message;
    const apiError = new Error(errorMsg);
    apiError.name = "APIError";
    apiError.status = error.response?.status;
    apiError.code = error.code;
    apiError.payload = payload; // Preservamos el payload para depuración y guardado
    apiError.response = error.response;
    return apiError;
  }

  /**
   * Normalizes and injects a message into the chat history.
   * Aplica una Fusión Sintáctica en la Raíz: si el mensaje entrante pertenece al mismo rol
   * que el último en el historial, los fusiona para mantener una secuencia estrictamente alternante.
   * @param {string} role - The role of the message sender.
   * @param {string|object|Array} content - The content of the message.
   * @param {string|null} [timestamp] - The timestamp of the message.
   */
  injectMessage(role, content, timestamp = null) {
    const apiRole = normalizeRole(role, this.user.nickname, this.model.nickname);
    const finalContent = normalizeContent(content, apiRole);
    const lastMessage = this.history[this.history.length - 1];

    if (lastMessage && lastMessage.role === apiRole) {
      // Fusión de mensajes consecutivos del mismo rol (ej. logs automáticos + input del usuario)
      lastMessage.content += `\n${finalContent}`;
      // Mantenemos el timestamp original del primer mensaje de la secuencia fusionada
      lastMessage.timestamp = lastMessage.timestamp || timestamp || IRCFormatter.getTimestamp();
    } else {
      this.history.push({
        role: apiRole,
        content: finalContent,
        timestamp: timestamp || IRCFormatter.getTimestamp(),
      });
    }
  }

  /**
   * Removes the last message from the chat history.
   */
  popLastMessage() {
    if (this.history.length > 0) {
      this.history.pop();
    }
  }

  /**
   * Resets the chat history, optionally with a new history array.
   * @param {Array|null} [historyOverride] - The new history to set.
   */
  hardReset(historyOverride = null) {
    this.history = historyOverride || [];
    logger.info("[CohereAdapter] History hard reset");
  }

  /**
   * Retrieves the current chat history.
   * @returns {Array} The history array.
   */
  getHistory() {
    return this.history;
  }

  /**
   * Fetches the list of available models from the Cohere API.
   * @returns {Promise<string[]>} A list of model names.
   */
  async getAvailableModels() {
    try {
      const response = await this.client.get("/models");
      return response.data.models.map((m) => m.name);
    } catch (error) {
      logger.error(`[CohereAdapter] Error fetching models: ${error.message}`);
      return ["command-r-plus", "command-r"];
    }
  }

  /**
   * Checks if a specific model is available and responding.
   * @param {string} modelName - The name of the model to check.
   * @returns {Promise<boolean>} True if available, false otherwise.
   */
  async checkAvailability(modelName) {
    try {
      // El endpoint v2 exige el uso del arreglo 'messages' en lugar de un string 'message' directo.
      await this.client.post("/chat", {
        model: modelName,
        messages: [{ role: "user", content: "hi" }],
        max_tokens: 1,
      });
      return true;
    } catch (error) {
      const status = error.response?.status;
      if (status === 404 || status === 400) return false;
      return true;
    }
  }
}

export default CohereAdapter;
