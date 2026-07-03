import FormatPlugin from "./FormatPlugin.js";

/**
 * Formats messages in Fountain screenplay style.
 */
class FountainFormat extends FormatPlugin {
  /**
   * Wraps text to fit within a specified column range.
   * @param {string} text - The text to be wrapped.
   * @param {number} start - The starting column position.
   * @param {number} end - The ending column position.
   * @returns {string} The wrapped text formatted with leading spaces.
   */
  _wrapText(text, start, end) {
    const width = end - start;
    const words = text.split(/\s+/);
    const lines = [];
    let currentLine = "";

    words.forEach((word) => {
      if ((currentLine + (currentLine ? " " : "") + word).length <= width) {
        currentLine += (currentLine ? " " : "") + word;
      } else {
        lines.push(currentLine);
        currentLine = word;
      }
    });
    lines.push(currentLine);

    return lines.map((line) => " ".repeat(start) + line).join("\n");
  }

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
        output = this._wrapText(cleanText, 0, 75);
      }
    } else {
      output += `${" ".repeat(37) + nickname.toUpperCase()}\n`;
      if (trimmedText.startsWith("*")) {
        const cleanText = trimmedText.replace(/^\*\s*|\s*\*$/g, "");
        output += this._wrapText(`(${cleanText})`, 31, 60);
      } else {
        output += this._wrapText(trimmedText, 25, 60);
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
