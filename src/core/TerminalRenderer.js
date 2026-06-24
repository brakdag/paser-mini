import chalk from "chalk";

class TerminalRenderer {
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

  renderFountain(nickname, text) {
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

  renderTable(tableText) {
    const lines = tableText.trim().split("\n");
    if (lines.length < 2) return tableText;

    const rows = lines
      .filter((line) => line.includes("|"))
      .map((line) =>
        line
          .split("|")
          .filter((cell, index, array) => {
            if (index === 0 && cell.trim() === "") return false;
            if (index === array.length - 1 && cell.trim() === "") return false;
            return true;
          })
          .map((cell) => cell.trim()),
      );

    const dataRows = rows.filter(
      (row) => !row.every((cell) => /^[:\s-]*$/.test(cell)),
    );

    if (dataRows.length === 0) return tableText;

    const colWidths = [];
    dataRows.forEach((row) => {
      row.forEach((cell, i) => {
        colWidths[i] = Math.max(colWidths[i] || 0, cell.length);
      });
    });

    let output = "";
    const separator = `+${colWidths.map((w) => "-".repeat(w + 2)).join("+")}+`;

    output += `${separator}\n`;
    dataRows.forEach((row, rowIndex) => {
      const line = `| ${row
        .map((cell, i) => cell.padEnd(colWidths[i]))
        .join(" | ")} |`;
      output += `${chalk.white(line)}\n`;
      if (rowIndex === 0) output += `${separator}\n`;
    });
    output += separator;

    return `\n${output}\n`;
  }

  formatMarkdown(text) {
    if (!text) return "";
    let formatted = text;
    const tableRegex = /((?:^\s*\|.*\n?)+)/gm;
    formatted = formatted.replace(tableRegex, (match) =>
      this.renderTable(match),
    );
    formatted = formatted.replace(
      /```([\s\S]*?)```/g,
      (_, code) => `\n${chalk.blueBright(code.trim())}\n`,
    );
    formatted = formatted.replace(/`([^`]+)`/g, (_, code) =>
      chalk.cyan(` ${code} `),
    );
    formatted = formatted.replace(/\*\*(.*?)\*\*/g, (_, content) =>
      chalk.bold(content),
    );
    formatted = formatted.replace(/\*(.*?)\*/g, (_, content) =>
      chalk.italic(content),
    );
    return formatted;
  }

  renderPanel(title, message, style = "none") {
    const border = "\u2500".repeat(title.length + 4);
    const panelColor = style === "warning" ? chalk.yellow : chalk.blue;
    let output = `\n${panelColor(`\u250c${border}\u2510`)}\n`;
    output += `${panelColor("\u2502")} ${chalk.bold(title)} ${panelColor(" ".repeat(border.length - title.length - 2))} ${panelColor("\u2502")}\n`;
    output += `${panelColor(`\u251c${"\u2500".repeat(border.length)}\u2524`)}\n`;
    output += `${panelColor("\u2502")} ${message} ${panelColor(" ".repeat(Math.max(0, border.length - message.length - 2)))} ${panelColor("\u2502")}\n`;
    output += `${panelColor(`\u2514${border}\u2518`)}\n\n`;
    return output;
  }
}

export default new TerminalRenderer();
