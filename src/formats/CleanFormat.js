import FormatPlugin from "./FormatPlugin.js";

/**
 * Formats messages in clean minimalist style: no timestamps, no prefixes.
 */
class CleanFormat extends FormatPlugin {
  /**
   * Formats a standard message with just nickname and text.
   * @param {string} nickname - The sender's nickname.
   * @param {string} text - The message text.
   * @returns {string} The formatted message.
   */
  formatMessage(nickname, text) {
    return `<${nickname}> ${text}`;
  }

  /**
   * Formats a system message without timestamps.
   * @param {string} text - The system message text.
   * @returns {string} The formatted system message.
   */
  formatSystem(text) {
    return text;
  }

  /**
   * Formats a narrative action cleanly.
   * @param {string} nickname - The sender's nickname.
   * @param {string} text - The action text.
   * @returns {string} The formatted action.
   */
  formatAction(nickname, text) {
    return `* ${nickname} ${text}`;
  }
}

export default CleanFormat;
