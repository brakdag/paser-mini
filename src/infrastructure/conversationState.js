import IRCFormatter from "../utils/ircFormatter.js";

class ConversationState {
  constructor(userNickname = "user", agentNickname = "assistant") {
    this.userNickname = userNickname;
    this.agentNickname = agentNickname;
    this.history = [];
    this.renderingMode = "IRC";
  }

  setRenderingMode(mode) {
    this.renderingMode = mode;
  }

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

  hardReset(historyOverride = null) {
    this.history = historyOverride || [];
  }

  popLastMessage() {
    if (this.history.length > 0) this.history.pop();
  }

  getRawHistory() {
    return this.history;
  }
}

export default ConversationState;

