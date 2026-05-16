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

  getTimestamp() {
    return new Date().toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  _formatMessage(role, text, timestamp = this.getTimestamp()) {
    if (this.renderingMode === "FOUNTAIN") return text;

    if (
      text.startsWith("---") ||
      text.startsWith("***") ||
      text.startsWith("<TOOL_RESPONSE>")
    ) {
      return `[${timestamp}] ${text}`;
    }
    const nickname = role === "user" ? this.userNickname : this.agentNickname;
    return `[${timestamp}] <${nickname}> ${text}`;
  }

  addMessage(role, text, timestamp = null) {
    const normalizedRole =
      role === "model" || role === "assistant" ? "model" : "user";

    const ts = timestamp || this.getTimestamp();
    
    // Store RAW text in history to avoid token noise in AI requests
    this.history.push({
      role: normalizedRole,
      text: text,
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
