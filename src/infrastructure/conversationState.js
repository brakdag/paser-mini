import IRCFormatter from "../utils/ircFormatter.js";

/**
 * Manages the conversation history and rendering state.
 */
class ConversationState {
  /**
   * @param {string} userNickname - The identifier for the human user.
   * @param {string} agentNickname - The identifier for the AI agent.
   */
  constructor(userNickname = "user", agentNickname = "assistant") {
    this.userNickname = userNickname;
    this.agentNickname = agentNickname;
    this.history = [];
    this.renderingMode = "IRC";
  }

  /**
   * @param {string} mode - The rendering mode to set.
   */
  setRenderingMode(mode) {
    this.renderingMode = mode;
  }

  /**
   * @param {string} role - The role of the message sender.
   * @param {string} text - The message text content.
   * @param {number|null} [timestamp] - Optional timestamp override.
   * @returns {string} The formatted message string.
   */
  _formatMessage(role, text, timestamp = null) {
    if (this.renderingMode === "FOUNTAIN") return text;

    if (
      text.startsWith("---") ||
      text.startsWith("***") ||
      text.startsWith("ø")
    ) {
      return `[${timestamp || IRCFormatter.getTimestamp()}] ${text}`;
    }

    const nickname = role === "user" ? this.userNickname : this.agentNickname;
    return IRCFormatter.formatMessage(nickname, text, timestamp);
  }

  /**
   * @param {string} role - The role of the message sender.
   * @param {string} text - The message text content.
   * @param {number|null} [timestamp] - Optional timestamp override.
   * @returns {string} The formatted message string.
   */
  addMessage(role, text, timestamp = null) {
    const normalizedRole =
      role === "model" || role === "assistant" ? "model" : "user";

    const ts = timestamp || IRCFormatter.getTimestamp();

    // Store RAW text in history to avoid token noise in AI requests
    this.history.push({
      role: normalizedRole,
      text,
      timestamp: ts,
    });

    return this._formatMessage(normalizedRole, text, ts);
  }

  /**
   * @param {Array|null} [historyOverride] - Optional history to apply during reset.
   */
  hardReset(historyOverride = null) {
    this.history = historyOverride || [];
  }

  /**
   * Removes the last message from the history.
   */
  popLastMessage() {
    if (this.history.length > 0) this.history.pop();
  }

  /**
   * @returns {Array} The current raw message history.
   */
  getRawHistory() {
    return this.history;
  }
}

export default ConversationState;

