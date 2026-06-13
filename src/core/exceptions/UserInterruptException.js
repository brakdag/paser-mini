export default class UserInterruptException extends Error {
  constructor(message = "User interrupted the agent") {
    super(message);
    this.name = "UserInterruptException";
  }
}