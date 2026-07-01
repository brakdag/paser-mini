import { normalizeRole, normalizeContent } from "./utils.js";
import IRCFormatter from "../../utils/ircFormatter.js";

/**
 * Manages chat history normalization and state for AI adapters.
 */
class HistoryManager {
  /**
   * Creates an instance of HistoryManager.
   * @param {string} userNickname - The user's nickname.
   * @param {string} agentNickname - The agent's nickname.
   */
  constructor(userNickname, agentNickname) {
    this.userNickname = userNickname;
    this.agentNickname = agentNickname;
    this.history = [];
  }

  /**
   * Normalizes and injects a message into the chat history.
   * @param {string} role - The role of the message sender.
   * @param {string|object|Array} content - The content of the message.
   * @param {string|null} [timestamp] - The timestamp of the message.
   */
  injectMessage(role, content, timestamp = null) {
    const apiRole = normalizeRole(role, this.userNickname, this.agentNickname);
    const finalContent = normalizeContent(content, apiRole);

    this.history.push({
      role: apiRole,
      content: finalContent,
      timestamp: timestamp || IRCFormatter.getTimestamp(),
    });
  }

  /**
   * Removes the last message from the chat history.
   */
  popLastMessage() {
    if (this.history.length > 0) {
      this.history.pop();
    }
  }

  /**
   * Resets the chat history, optionally with a new history array.
   * @param {Array|null} [historyOverride] - The new history to set.
   */
  hardReset(historyOverride = null) {
    this.history = historyOverride || [];
  }

  /**
   * Retrieves the current chat history.
   * @returns {Array} The history array.
   */
  getHistory() {
    return this.history;
  }
}

export default HistoryManager;