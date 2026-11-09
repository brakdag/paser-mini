import { UserInterruptException } from "./exceptions.js";

/**
 * Handles communication with the API, including cancellation and domain recovery.
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
    this.pendingRequest = null;
  }

  /**
   * Cancels the active request so a queued model change can be processed.
   * @returns {void}
   */
  cancelPendingRequest() {
    this.pendingRequest?.abort(new UserInterruptException("Model selection requested"));
  }

  /**
   * Sends a message to the assistant with cancellation; the adapter owns transport retries.
   * @param {string|Array} message - The message to send.
   * @param {object} [options] - The options for the send operation.
   * @param {string} [options.role] - The role of the sender.
   * @returns {Promise<string|object>} The response from the assistant.
   * @throws {Error} If the maximum number of retries is reached or a non-retryable error occurs.
   */
  async send(message, { role = "user" } = {}) {
    if (this.pendingRequest) throw new Error("An API request is already active");
    const controller = new AbortController();
    this.pendingRequest = controller;
    try {
      const response = await this.assistant.sendMessage(message, role, { signal: controller.signal });
      controller.signal.throwIfAborted();
      return response;
    } catch (error) {
      controller.signal.throwIfAborted();
      throw error;
    } finally {
      this.pendingRequest = null;
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
      { role: "user" },
    );
  }
}

export default ApiCommunicator;
