/**
 * Exception thrown when the user interrupts the agent's execution flow.
 */
export default class UserInterruptException extends Error {
  /**
   * Creates an instance of UserInterruptException.
   * @param {string} [message] The error message.
   */
  constructor(message = "User interrupted the agent") {
    super(message);
    this.name = "UserInterruptException";
  }
}
