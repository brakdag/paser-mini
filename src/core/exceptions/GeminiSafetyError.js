/**
 * Exception thrown when the Gemini API blocks a response due to safety filters.
 */
export default class GeminiSafetyError extends Error {
  /**
   * Creates an instance of GeminiSafetyError.
   * @param {string} [message] The error message.
   */
  constructor(message = "Response blocked by safety filters") {
    super(message);
    this.name = "GeminiSafetyError";
  }
}
