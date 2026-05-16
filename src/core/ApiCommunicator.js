import logger from "./logger.js";

class ApiCommunicator {
  constructor(assistant, ui) {
    this.assistant = assistant;
    this.ui = ui;
    this.maxRetries = 5000;
    this.baseDelay = 1000;
  }

  async send(message, role = "user", attempt = 1) {
    try {
      return await this.assistant.sendMessage(message, role);
    } catch (error) {
      if (attempt >= this.maxRetries) throw error;

      const isRetryable =
        !error.response ||
        [429, 500, 502, 503, 504].includes(error.response.status);

      if (!isRetryable) throw error;

      const delay = this.baseDelay * 2 ** (attempt - 1);
      this.ui.displayError(
        `API Error: ${error.message}. Retrying in ${delay}ms... (Attempt ${attempt}/${this.maxRetries})`,
      );

      await new Promise((resolve) => setTimeout(resolve, delay));
      return this.send(message, role, attempt + 1);
    }
  }

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