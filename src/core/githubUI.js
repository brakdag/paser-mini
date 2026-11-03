import GithubTools from "../tools/githubTools.js";
import logger from "./logger.js";

/**
 * Provides a UI implementation for interacting with GitHub issues, acting as a bridge
 * between the ChatManager and the GitHub API.
 */
class GitHubUI {
  /**
   * Initializes the GitHubUI instance.
   * @param {number} issueNumber - The GitHub issue number to interact with.
   * @param {string|null} [repo] - The repository name, if different from the default.
   * @param {object} [githubApi] - Injectable GitHub client.
   */
  constructor(issueNumber, repo = null, githubApi = new GithubTools()) {
    this.issueNumber = issueNumber;
    this.repo = repo;
    this.bashEnabled = false;
    this.githubApi = githubApi;
    this.pending = Promise.resolve();
    this.publicationErrors = [];
  }

  /**
   * Rejects interactive input; the orchestrator must use a single turn.
   * @param {string} _prompt - The prompt to display (unused in GitHub mode).
   * @returns {Promise<string>} Always rejects because this UI has no input source.
   */
  async requestInput(_prompt) {
    throw new Error("GitHub mode accepts one turn; interactive input is unavailable.");
  }

  /**
   * Posts a message as a comment to the GitHub issue.
   * @param {string} text - The text to post as a comment.
   * @returns {Promise<void>}
   */
  displayMessage(text) {
    const publication = this.pending.then(() => this.githubApi.postComment(this.issueNumber, text, this.repo));
    // Synchronous tool/UI callers may ignore the returned promise. Capture rejection immediately.
    this.pending = publication.catch((error) => { this.publicationErrors.push(error); });
    return publication;
  }

  /**
   * Waits for every queued comment and propagates publication failures.
   * @returns {Promise<void>} Resolves when all comments have settled.
   */
  async flush() {
    await this.pending;
    const errors = this.publicationErrors.splice(0);
    if (errors.length) throw new AggregateError(errors, "GitHub comment publication failed");
  }

  /**
   * Logs a thought process to the console for debugging purposes.
   * @param {string} text - The thought text to log.
   * @returns {void}
   */
  displayThought(text) {
    logger.info(`[GitHubUI] [THOUGHT] [Issue ${this.issueNumber}] ${text}`);
  }

  /**
   * Logs an informational message to the console.
   * @param {string} message - The info message to log.
   * @returns {void}
   */
  displayInfo(message) {
    logger.info(`[GitHubUI] [INFO] [Issue ${this.issueNumber}] ${message}`);
  }

  /**
   * Logs an error message to the console.
   * @param {string} message - The error message to log.
   * @returns {void}
   */
  displayError(message) {
    logger.error(`[GitHubUI] [ERROR] [Issue ${this.issueNumber}] ${message}`);
  }

  /**
   * Logs the status of a tool execution to the console.
   * @param {string} toolName - The name of the tool executed.
   * @param {boolean} success - Whether the tool execution was successful.
   * @param {string} [detail] - Additional details about the tool execution.
   * @returns {void}
   */
  displayToolStatus(toolName, success, detail = "") {
    const status = success ? "OK" : "FAIL";
    logger.info(`[GitHubUI] [TOOL] [Issue ${this.issueNumber}] ${toolName} -> ${status} ${detail}`);
  }

  /**
   * Requests confirmation from the user. In GitHub mode, this always defaults to true.
   * @param {string} message - The confirmation message.
   * @returns {Promise<boolean>} A promise that resolves to true.
   */
  async getConfirmation(message) {
    logger.info(`[GitHubUI] [CONFIRMATION REQUEST] [Issue ${this.issueNumber}] ${message} -> Defaulting to True`);
    return true;
  }

  /**
   * Logs the start of tool monitoring to the console.
   * @param {string} toolName - The name of the tool being monitored.
   * @param {string} [detail] - Additional details about the tool.
   * @returns {void}
   */
  startToolMonitoring(toolName, detail = "") {
    logger.info(`[GitHubUI] [MONITORING START] [Issue ${this.issueNumber}] ${toolName} -> ${detail}`);
  }

  /**
   * Logs the end of tool monitoring to the console.
   * @param {string} toolName - The name of the tool that finished executing.
   * @param {boolean} success - Whether the tool execution was successful.
   * @returns {void}
   */
  endToolMonitoring(toolName, success) {
    const status = success ? "OK" : "FAIL";
    logger.info(`[GitHubUI] [MONITORING END] [Issue ${this.issueNumber}] ${toolName} -> ${status}`);
  }

  /**
   * Logs that all tool monitoring has been stopped.
   * @returns {void}
   */
  stopAllMonitoring() {
    logger.info(`[GitHubUI] [MONITORING STOPPED] [Issue ${this.issueNumber}]`);
  }

  /**
   * Logs a spacing marker to the console.
   * @returns {void}
   */
  addSpacing() {
    logger.info(`[GitHubUI] [SPACING] [Issue ${this.issueNumber}]`);
  }

  /**
   * Logs a queue update marker to the console.
   * @returns {void}
   */
  updateQueueCount() {
    logger.info(`[GitHubUI] [QUEUE UPDATE] [Issue ${this.issueNumber}]`);
  }

  /**
   * Sets whether bash execution is enabled for this UI instance.
   * @param {boolean} enabled - The enabled state of bash execution.
   * @returns {void}
   */
  setBashEnabled(enabled) {
    this.bashEnabled = enabled;
  }

  /**
   * Stores the command handler for tools that access the session.
   * @param {object} handler - The command handler instance.
   * @returns {void}
   */
  setCommandHandler(handler) { this.commandHandler = handler; }

  /**
   * Stores the shared identities used by the turn processor.
   * @param {object} user - The user identity object.
   * @param {object} model - The model identity object.
   * @returns {void}
   */
  setIdentities(user, model) { this.user = user; this.model = model; }

  /**
   * Stores the session rendering mode.
   * @param {string} mode - The rendering mode to set.
   * @returns {void}
   */
  setRenderingMode(mode) { this.renderingMode = mode; }

  /**
   * Rejects terminal initialization in the batch UI.
   * @returns {void}
   */
  initInput() { throw new Error("GitHub mode does not initialize terminal input."); }

  /**
   * Generates the log session resumption string.
   * @returns {string} The formatted log opened string.
   */
  getLogOpenedString() {
    return "--- GitHub Mode Session Started ---";
  }

  /**
   * Publishes raw tool output using the same ordered queue as chat messages.
   * @param {string} text - The raw tool output.
   * @returns {Promise<void>} The queued publication.
   */
  displayRawMessage(text) {
    return this.displayMessage(text);
  }

  /**
   * Displays a chat message by posting it to the GitHub issue.
   * @param {string} _nickname - The nickname of the sender.
   * @param {string} text - The message text.
   * @returns {Promise<void>}
   */
  displayChatMessage(_nickname, text) {
    return this.displayMessage(text);
  }
}

export default GitHubUI;