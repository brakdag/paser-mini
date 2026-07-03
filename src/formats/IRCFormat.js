import FormatPlugin from "./FormatPlugin.js";
import IRCFormatter from "../utils/ircFormatter.js";

/**
 * Formats messages in standard IRC log style.
 */
class IRCFormat extends FormatPlugin {
  /**
   * Formats a message into the standard IRC string.
   * @param {string} nickname - The sender's nickname.
   * @param {string} text - The message text.
   * @returns {string} The formatted IRC message.
   */
  formatMessage(nickname, text) {
    return IRCFormatter.formatMessage(nickname, text);
  }

  /**
   * Formats a system message with a timestamp.
   * @param {string} text - The system message text.
   * @returns {string} The formatted system message.
   */
  formatSystem(text) {
    const ts = IRCFormatter.getTimestamp();
    return `[${ts}] ${text}`;
  }

  /**
   * Formats a narrative action.
   * @param {string} nickname - The sender's nickname.
   * @param {string} text - The action text.
   * @returns {string} The formatted action.
   */
  formatAction(nickname, text) {
    const ts = IRCFormatter.getTimestamp();
    return `[${ts}] * ${nickname} ${text}`;
  }
}

export default IRCFormat;
