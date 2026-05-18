class UserInterruptException extends Error {
  constructor(message = "User interrupted the agent") {
    super(message);
    this.name = "UserInterruptException";
  }
}

class GeminiSafetyError extends Error {
  constructor(message = "Response blocked by safety filters") {
    super(message);
    this.name = "GeminiSafetyError";
  }
}

class GeminiEmptyResponseError extends Error {
  constructor(message = "No content parts returned from API") {
    super(message);
    this.name = "GeminiEmptyResponseError";
  }
}

export { UserInterruptException, GeminiSafetyError, GeminiEmptyResponseError };
export default UserInterruptException;