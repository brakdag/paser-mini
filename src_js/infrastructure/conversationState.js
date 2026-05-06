export class ConversationState {
  constructor(userNickname = 'user', agentNickname = 'assistant') {
    this.userNickname = userNickname;
    this.agentNickname = agentNickname;
    this.history = [];
  }

  getTimestamp() {
    return new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  }

  _formatMessage(role, text, timestamp = this.getTimestamp()) {
    // Preserve IRC aesthetics: system events (starting with ---, *** or <TOOL_RESPONSE>) do not have nicknames
    if (text.startsWith('---') || text.startsWith('***') || text.startsWith('<TOOL_RESPONSE>')) {
      return `[${timestamp}] ${text}`;
    }
    const nickname = role === 'user' ? this.userNickname : this.agentNickname;
    return `[${timestamp}] <${nickname}> ${text}`;
  }

  addMessage(role, text, timestamp = null) {
    // Strict role mapping for maximum compatibility
    // Only 'user' and 'model' are allowed in the state
    const normalizedRole = (role === 'model' || role === 'assistant') ? 'model' : 'user';
    
    const ts = timestamp || this.getTimestamp();
    const formattedText = this._formatMessage(normalizedRole, text, ts);
    this.history.push({
      role: normalizedRole,
      text: formattedText,
      timestamp: ts
    });
    return formattedText;
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