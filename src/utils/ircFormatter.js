import chalk from "chalk";

/**
 * Utility class for formatting messages in IRC-style format.
 */
class IRCFormatter {
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
   * @param {string} agentNickname - The nickname of the AI agent.
   * @param {string} [timestamp] - Optional override for the timestamp.
   * @returns {string} The formatted terminal message string with colors.
   */
  static formatTerminalMessage(
    nickname,
    text,
    agentNickname,
    timestamp = null,
  ) {
    const ts = timestamp || this.getTimestamp();
    const nameColor = nickname === agentNickname ? chalk.cyan : chalk.green;
    return `${chalk.white(`[${ts}]`)} <${nameColor(nickname)}> ${text}`;
  }
}

export default IRCFormatter;
