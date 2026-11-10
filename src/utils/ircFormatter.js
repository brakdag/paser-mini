import chalk from "chalk";

/**
 * Utility class for formatting messages in IRC-style format.
 */
class IRCFormatter {
  /**
   * Removes echoed headers only at the start of the agent's own reply.
   * Fenced/indented code, quotes, other speakers and subsequent lines stay intact.
   * @param {string} text - Reply body, possibly prefixed with repeated IRC headers.
   * @param {string} nickname - Exact agent nickname, compared literally.
   * @returns {string} Body without transport headers.
   */
  static stripReplyHeaders(text, nickname) {
    const header = /^(?:[ \t]*\r?\n)* {0,3}\[(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?\][ \t]+<([^>\r\n]+)>[ \t]*(?:\r?\n)?/u;
    let body = text;
    let match = header.exec(body);
    while (match && match[1] === nickname) {
      body = body.slice(match[0].length);
      match = header.exec(body);
    }
    return body;
  }

  /**
   * Generates a timestamp in [HH:mm] format.
   * @returns {string} The formatted timestamp string.
   */
  static getTimestamp() {
    return new Date().toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  /**
   * Formats a message into the standard IRC string.
   * @param {string} nickname - The nickname of the message sender.
   * @param {string} text - The message content.
   * @param {string} [timestamp] - Optional override for the timestamp.
   * @returns {string} The formatted IRC message string.
   */
  static formatMessage(nickname, text, timestamp = null) {
    const ts = timestamp || this.getTimestamp();
    if (text && text.startsWith("ø")) {
      return `[${ts}] ${text}`;
    }
    return `[${ts}] <${nickname}> ${text}`;
  }

  /**
   * Formats a system/info message.
   * @param {string} type - The message type (e.g. 'INFO', 'ERROR').
   * @param {string} text - The message content.
   * @param {string} [timestamp] - Optional override for the timestamp.
   * @returns {string} The formatted system message string.
   */
  static formatSystemMessage(type, text, timestamp = null) {
    const ts = timestamp || this.getTimestamp();
    return `[${ts}] [${type}] ${text}`;
  }

  /**
   * Formats a message for terminal output with colors.
   * @param {string} nickname - The nickname of the message sender.
   * @param {string} text - The message content.
   * @param {string} _agentNickname - The nickname of the AI agent.
   * @param {string} [timestamp] - Optional override for the timestamp.
   * @returns {string} The formatted terminal message string with colors.
   */
  static formatTerminalMessage(
    nickname,
    text,
    _agentNickname,
    timestamp = null,
  ) {
    const ts = timestamp || this.getTimestamp();
    return `[${ts}] <${nickname}> ${text}`;
  }

  /**
   * Formats an action message for terminal output with colors.
   * @param {string} nickname - The nickname of the action performer.
   * @param {string} actionText - The action text.
   * @param {string} statusIcon - The status icon (e.g., '✓', '✗').
   * @param {string} [timestamp] - Optional override for the timestamp.
   * @returns {string} The formatted terminal action string with colors.
   */
  static formatTerminalAction(
    nickname,
    actionText,
    statusIcon,
    timestamp = null,
  ) {
    const ts = timestamp || this.getTimestamp();
    const nameColor = chalk.cyan;
    return `${chalk.white(`[${ts}]`)} <${nameColor(nickname)}> ${actionText} ${statusIcon}`;
  }
}

export default IRCFormatter;
