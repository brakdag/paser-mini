import IRCFormatter from "../utils/ircFormatter.js";

/**
 *
 */
class ConversationState {
  /**
   *
   * @param userNickname
   * @param agentNickname
   */
  constructor(userNickname = "user", agentNickname = "assistant") {
    this.userNickname = userNickname;
    this.agentNickname = agentNickname;
    this.history = [];
    this.renderingMode = "IRC";
  }

  /**
   *
   * @param mode
   */
  setRenderingMode(mode) {
    this.renderingMode = mode;
  }

  /**
   *
   * @param role
   * @param text
   * @param timestamp
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
   *
   * @param role
   * @param text
   * @param timestamp
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
   *
   * @param historyOverride
   */
  hardReset(historyOverride = null) {
    this.history = historyOverride || [];
  }

  /**
   *
   */
  popLastMessage() {
    if (this.history.length > 0) this.history.pop();
  }

  /**
   *
   */
  getRawHistory() {
    return this.history;
  }
}

export default ConversationState;

