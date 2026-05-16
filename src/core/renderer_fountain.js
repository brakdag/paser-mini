import BaseRenderer from "./renderer_base";

class FountainRenderer extends BaseRenderer {
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

    return lines.map((line) => `${" ".repeat(start)}${line}`).join("\n");
  }

  render(message) {
    const { nickname, text, type } = message;
    const trimmedText = text.trim();

    // Filter out tool calls and tool responses from visual output
    if (
      trimmedText.includes("<TOOL_CALL>") ||
      trimmedText.includes("<TOOL_RESPONSE>")
    ) {
      return "";
    }

    let output = "";

    if (type === "system") {
      if (trimmedText.startsWith("* SCENE:")) {
        const sceneText = trimmedText
          .replace(/^\* SCENE:\s*|\s*\*$/g, "")
          .toUpperCase();
        output = `\n${sceneText}\n`;
      } else {
        const cleanText = trimmedText.replace(
          /^(\* ACTION:\s*|\*\*\*|---|-!-)\s*|\s*\*$/g,
          "",
        );
        output = this._wrapText(cleanText, 0, 75);
      }
    } else if (nickname === "dialogue") {
      if (trimmedText.startsWith("*")) {
        const cleanText = trimmedText.replace(/^\*\s*|\s*\*$/g, "");
        output += this._wrapText(`(${cleanText})`, 31, 60);
      } else {
        output += this._wrapText(trimmedText, 25, 60);
      }
    } else {
      output += `${" ".repeat(37)}${nickname.toUpperCase()}\n`;

      if (trimmedText.startsWith("*")) {
        const cleanText = trimmedText.replace(/^\*\s*|\s*\*$/g, "");
        output += this._wrapText(`(${cleanText})`, 31, 60);
      } else {
        output += this._wrapText(this.ui.formatMarkdown(trimmedText), 25, 60);
      }
    }

    return `${output}\n`;
  }
}


export default FountainRenderer;
