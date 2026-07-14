/**
 * Handles communication with the API, including retry logic and error recovery.
 */
const RETRYABLE_NETWORK_ERRORS = ['ECONNABORTED', 'ETIMEDOUT', 'ECONNRESET', 'ERR_NETWORK', 'ENOTFOUND', 'EAI_AGAIN', 'EHOSTUNREACH', 'ENETUNREACH', 'ECONNREFUSED', 'EPIPE'];
const RETRYABLE_SERVER_STATUSES = [429, 500, 502, 503, 504];

/**
 * Handles communication with the API, including retry logic and error recovery.
 */
class ApiCommunicator {
  /**
   * Initializes the ApiCommunicator.
   * @param {object} assistant - The assistant instance for sending messages.
   * @param {object} ui - The UI instance for displaying errors.
   */
  constructor(assistant, ui) {
    this.assistant = assistant;
    this.ui = ui;
    this.maxRetries = 5;
    this.baseDelay = 1000;
  }

  /**
   * Sends a message to the assistant with exponential backoff retry logic.
   * @param {string} message - The message to send.
   * @param {string} [role] - The role of the sender.
   * @param {number} [attempt] - The current attempt number.
   * @returns {Promise<string|object>} The response from the assistant.
   * @throws {Error} If the maximum number of retries is reached or a non-retryable error occurs.
   */
  async send(message, role = "user", attempt = 1) {
    try {
      return await this.assistant.sendMessage(message, role);
    } catch (error) {
      if (attempt >= this.maxRetries) throw error;

      const httpStatus = error.response?.status;
      const isNetworkError = error.code && RETRYABLE_NETWORK_ERRORS.includes(error.code);
      const isServerError = httpStatus && RETRYABLE_SERVER_STATUSES.includes(httpStatus);

      // Only retry if it is a known network error or a server error (500s)
      const isRetryable = isNetworkError || isServerError;
      if (!isRetryable) throw error;

      const statusCode = httpStatus || error.code || (error.name === "ServiceDegradedError" ? 503 : error.message);
      const delay = this.baseDelay * 2 ** (attempt - 1);
      this.ui.displayError(
        `API Error ${statusCode}: Retrying in ${delay}ms... (Attempt ${attempt}/${this.maxRetries})`,
      );

      await new Promise((resolve) => {
        setTimeout(resolve, delay);
      });
      return this.send(message, role, attempt + 1);
    }
  }

  /**
   * Attempts to recover from an API communication error by sending a recovery request.
   * @param {string|object} currentResponse - The response that caused the error.
   * @param {number} attempt - The current recovery attempt number.
   * @param {number} maxRecoveries - The maximum number of recovery attempts.
   * @returns {Promise<string|object|null>} The recovered response or null if recovery failed.
   */
  async recover(currentResponse, attempt, maxRecoveries) {
    if (attempt >= maxRecoveries) return null;

    this.ui.displayError(
      `API Communication Error (Attempt ${attempt}/${maxRecoveries}): ${currentResponse}`,
    );

    return this.send(
      `System Error: ${currentResponse}. Please attempt to recover or rephrase your last action.`,
      "user",
    );
  }
}

export default ApiCommunicator;