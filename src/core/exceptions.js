export class UserInterruptException extends Error {
  constructor(message = "User interrupted the agent") {
    super(message);
    this.name = "UserInterruptException";
  }
}

export class GeminiSafetyError extends Error {
  constructor(message = "Gemini safety filters blocked the response") {
    super(message);
    this.name = "GeminiSafetyError";
  }
}

export class GeminiEmptyResponseError extends Error {
  constructor(message = "Gemini returned an empty response") {
    super(message);
    this.name = "GeminiEmptyResponseError";
  }
}