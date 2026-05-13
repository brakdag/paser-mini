import { BaseRenderer } from "./renderer_base.js";

export class FountainRenderer extends BaseRenderer {
  constructor(ui) {
    super(ui);
  }

  _wrapText(text, start, end) {
    const width = end - start;
    const words = text.split(/\s+/);
    let lines = [];
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

  render(message) {
    const { nickname, text, type } = message;
    const trimmedText = text.trim();
    let output = "";

    if (type === 'system') {
      // Scene Heading or Action
      if (trimmedText.startsWith("* SCENE:")) {
        const sceneText = trimmedText
          .replace(/^\* SCENE:\s*|\s*\*$/g, "")
          .toUpperCase();
        output = "\n" + sceneText + "\n";
      } else {
        const cleanText = trimmedText.replace(
          /^(\* ACTION:\s*|\*\*\*|---|-!-)\s*|\s*\*$/g,
          "",
        );
        output = this._wrapText(cleanText, 0, 75);
      }
    } else if (nickname === "dialogue") {
      // Dialogue without nickname
      if (trimmedText.startsWith("*")) {
        const cleanText = trimmedText.replace(/^\*\s*|\s*\*$/g, "");
        output += this._wrapText(`(${cleanText})`, 31, 60);
      } else {
        output += this._wrapText(trimmedText, 25, 60);
      }
    } else {
      // Character and Dialogue/Parenthetical
      output += " ".repeat(37) + nickname.toUpperCase() + "\n";

      if (trimmedText.startsWith("*")) {
        // Parenthetical
        const cleanText = trimmedText.replace(/^\*\s*|\s*\*$/g, "");
        output += this._wrapText(`(${cleanText})`, 31, 60);
      } else {
        // Dialogue
        output += this._wrapText(this.ui.formatMarkdown(trimmedText), 25, 60);
      }
    }

    return output + "\n";
  }
}