import chalk from "chalk";

class IRCFormatter {
  /**
   * Generates a timestamp in [HH:mm] format.
   * @returns {string}
   */
  static getTimestamp() {
    return new Date().toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  /**
   * Formats a message into the standard IRC string.
   * @param {string} nickname 
   * @param {string} text 
   * @param {string} [timestamp] - Optional override for the timestamp
   * @returns {string}
   */
  static formatMessage(nickname, text, timestamp = null) {
    const ts = timestamp || this.getTimestamp();
    return `[${ts}] <${nickname}> ${text}`;
  }

  /**
   * Formats a system/info message.
   * @param {string} type - 'INFO', 'ERROR', etc.
   * @param {string} text 
   * @param {string} [timestamp] 
   * @returns {string}
   */
  static formatSystemMessage(type, text, timestamp = null) {
    const ts = timestamp || this.getTimestamp();
    return `[${ts}] [${type}] ${text}`;
  }

  /**
   * Formats a message for terminal output with colors.
   * @param {string} nickname 
   * @param {string} text 
   * @param {string} agentNickname 
   * @param {string} [timestamp] 
   * @returns {string}
   */
  static formatTerminalMessage(nickname, text, agentNickname, timestamp = null) {
    const ts = timestamp || this.getTimestamp();
    const nameColor = nickname === agentNickname ? chalk.cyan : chalk.green;
    return `${chalk.white(`[${ts}]`)} <${nameColor(nickname)}> ${text}`;
  }
}

export default IRCFormatter;