/**
 * Exception thrown when the Gemini API returns a response with no content parts.
 */
export default class GeminiEmptyResponseError extends Error {
  /**
   * Creates an instance of GeminiEmptyResponseError.
   * @param {string} [message] The error message.
   */
  constructor(message = "No content parts returned from API") {
    super(message);
    this.name = "GeminiEmptyResponseError";
  }
}
