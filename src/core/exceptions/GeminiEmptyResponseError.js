export default class GeminiEmptyResponseError extends Error {
  constructor(message = "No content parts returned from API") {
    super(message);
    this.name = "GeminiEmptyResponseError";
  }
}