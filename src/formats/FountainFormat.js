import FormatPlugin from "./FormatPlugin.js";
import wrapText from "../utils/textUtils.js";

/**
 * Formats messages in Fountain screenplay style.
 */
class FountainFormat extends FormatPlugin {
  /**
   * Renders text according to Fountain screenplay formatting rules.
   * @param {string} nickname - The nickname of the character or "system".
   * @param {string} text - The text to render.
   * @returns {string} The formatted Fountain output.
   */
  formatMessage(nickname, text) {
    const trimmedText = text.trim();
    let output = "";

    if (nickname === "system") {
      if (trimmedText.startsWith("* SCENE:")) {
        const sceneText = trimmedText
          .replace(/^\* SCENE:\s*|\s*\*$/g, "")
          .toUpperCase();
        output = `\n${sceneText}\n`;
      } else {
        const cleanText = trimmedText.replace(
          /^(\* ACTION:\s*|\*\*\*|---|--!-)\s*|\s*\*$/g,
          "",
        );
        output = wrapText(cleanText, 0, 75);
      }
    } else {
      output += `${" ".repeat(37) + nickname.toUpperCase()}\n`;
      if (trimmedText.startsWith("*")) {
        const cleanText = trimmedText.replace(/^\*\s*|\s*\*$/g, "");
        output += wrapText(`(${cleanText})`, 31, 60);
      } else {
        output += wrapText(trimmedText, 25, 60);
      }
    }
    return output;
  }

  /**
   * Formats a system message as an action in Fountain style.
   * @param {string} text - The system message text.
   * @returns {string} The formatted system message.
   */
  formatSystem(text) {
    return this.formatMessage("system", text);
  }

  /**
   * Formats an action in Fountain style.
   * @param {string} _nickname - The sender's nickname (unused in Fountain).
   * @param {string} text - The action text.
   * @returns {string} The formatted action.
   */
  formatAction(_nickname, text) {
    return this.formatMessage("system", `* ACTION: ${text} *`);
  }
}

export default FountainFormat;
