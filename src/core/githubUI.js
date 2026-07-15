import GithubTools from "../tools/githubTools.js";

/**
 * Provides a UI implementation for interacting with GitHub issues, acting as a bridge
 * between the ChatManager and the GitHub API.
 */
class GitHubUI {
  /**
   * Initializes the GitHubUI instance.
   * @param {number} issueNumber - The GitHub issue number to interact with.
   * @param {string|null} [repo] - The repository name, if different from the default.
   */
  constructor(issueNumber, repo = null) {
    this.issueNumber = issueNumber;
    this.repo = repo;
    this.bashEnabled = false;
  }

  /**
   * Requests input from the user. In GitHub mode, this is not supported and returns an empty string.
   * @param {string} _prompt - The prompt to display (unused in GitHub mode).
   * @returns {Promise<string>} A promise that resolves to an empty string.
   */
  async requestInput(_prompt) {
    return "";
  }

  /**
   * Posts a message as a comment to the GitHub issue.
   * @param {string} text - The text to post as a comment.
   * @returns {Promise<void>}
   */
  async displayMessage(text) {
    console.log(`[POSTING TO GITHUB] Issue #${this.issueNumber}: ${text}`);
    try {
      const githubApi = new GithubTools();
      await githubApi.postComment(this.issueNumber, text, this.repo);
    } catch (e) {
      console.error(`Error in displayMessage: ${e.message}`);
    }
  }

  /**
   * Logs a thought process to the console for debugging purposes.
   * @param {string} text - The thought text to log.
   * @returns {void}
   */
  displayThought(text) {
    console.log(`[THOUGHT] [Issue ${this.issueNumber}] ${text}`);
  }

  /**
   * Logs an informational message to the console.
   * @param {string} message - The info message to log.
   * @returns {void}
   */
  displayInfo(message) {
    console.log(`[INFO] [Issue ${this.issueNumber}] ${message}`);
  }

  /**
   * Logs an error message to the console.
   * @param {string} message - The error message to log.
   * @returns {void}
   */
  displayError(message) {
    console.error(`[ERROR] [Issue ${this.issueNumber}] ${message}`);
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
    console.log(
      `[TOOL] [Issue ${this.issueNumber}] ${toolName} -> ${status} ${detail}`,
    );
  }

  /**
   * Requests confirmation from the user. In GitHub mode, this always defaults to true.
   * @param {string} message - The confirmation message.
   * @returns {Promise<boolean>} A promise that resolves to true.
   */
  async getConfirmation(message) {
    console.log(
      `[CONFIRMATION REQUEST] [Issue ${this.issueNumber}] ${message} -> Defaulting to True`,
    );
    return true;
  }

  /**
   * Logs the start of tool monitoring to the console.
   * @param {string} toolName - The name of the tool being monitored.
   * @param {string} [detail] - Additional details about the tool.
   * @returns {void}
   */
  startToolMonitoring(toolName, detail = "") {
    console.log(
      `[MONITORING START] [Issue ${this.issueNumber}] ${toolName} -> ${detail}`,
    );
  }

  /**
   * Logs the end of tool monitoring to the console.
   * @param {string} toolName - The name of the tool that finished executing.
   * @param {boolean} success - Whether the tool execution was successful.
   * @returns {void}
   */
  endToolMonitoring(toolName, success) {
    const status = success ? "OK" : "FAIL";
    console.log(
      `[MONITORING END] [Issue ${this.issueNumber}] ${toolName} -> ${status}`,
    );
  }

  /**
   * Logs that all tool monitoring has been stopped.
   * @returns {void}
   */
  stopAllMonitoring() {
    console.log(`[MONITORING STOPPED] [Issue ${this.issueNumber}]`);
  }

  /**
   * Logs a spacing marker to the console.
   * @returns {void}
   */
  addSpacing() {
    console.log(`[SPACING] [Issue ${this.issueNumber}]`);
  }

  /**
   * Logs a queue update marker to the console.
   * @returns {void}
   */
  updateQueueCount() {
    console.log(`[QUEUE UPDATE] [Issue ${this.issueNumber}]`);
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
   * Sets the command handler (no-op for GitHub mode).
   * @param {object} _handler - The command handler instance.
   * @returns {void}
   */
  setCommandHandler(_handler) {}

  /**
   * Sets the shared user and model identity objects (no-op for GitHub mode).
   * @param {object} _user - The user identity object.
   * @param {object} _model - The model identity object.
   * @returns {void}
   */
  setIdentities(_user, _model) {}

  /**
   * Sets the rendering mode (no-op for GitHub mode).
   * @param {string} _mode - The rendering mode to set.
   * @returns {void}
   */
  setRenderingMode(_mode) {}

  /**
   * Initializes the terminal input handler (no-op for GitHub mode).
   * @returns {void}
   */
  initInput() {}

  /**
   * Generates the log session resumption string.
   * @returns {string} The formatted log opened string.
   */
  getLogOpenedString() {
    return "--- GitHub Mode Session Started ---";
  }

  /**
   * Displays a chat message by posting it to the GitHub issue.
   * @param {string} _nickname - The nickname of the sender.
   * @param {string} text - The message text.
   * @returns {Promise<void>}
   */
  async displayChatMessage(_nickname, text) {
    return this.displayMessage(text);
  }
}

export default GitHubUI;