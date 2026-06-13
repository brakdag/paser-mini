export default class GeminiSafetyError extends Error {
  constructor(message = "Response blocked by safety filters") {
    super(message);
    this.name = "GeminiSafetyError";
  }
}