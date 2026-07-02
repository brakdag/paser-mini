import chalk from "chalk";

/**
 * Handles the rendering of text, tables, and panels to the terminal with specific formatting.
 */
class TerminalRenderer {
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
          /^(\* ACTION:\s*|\*\*\*|---|--!-)\s*|\s*\*$/g,
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

  /**
   * Wraps a single string of text to fit within a specified width.
   * @param {string} text - The text to wrap.
   * @param {number} width - The maximum width in characters.
   * @returns {string[]} An array of wrapped lines.
   */
  _wrapCellText(text, width) {
    if (text.length <= width) return [text];
    const words = text.split(/\s+/);
    const lines = [];
    let currentLine = "";
    words.forEach((word) => {
      if (word.length > width) {
        if (currentLine) lines.push(currentLine);
        for (let i = 0; i < word.length; i += width) {
          lines.push(word.substring(i, i + width));
        }
        currentLine = "";
      } else if ((currentLine + (currentLine ? " " : "") + word).length <= width) {
        currentLine += (currentLine ? " " : "") + word;
      } else {
        lines.push(currentLine);
        currentLine = word;
      }
    });
    if (currentLine) lines.push(currentLine);
    return lines;
  }

  /**
   * Renders a markdown-style table into a formatted terminal table.
   * Uses Unicode box-drawing characters and enforces a maximum width of 120 chars.
   * @param {string} tableText - The raw table text to render.
   * @returns {string} The formatted table string.
   */
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

    const numCols = dataRows[0].length;
    const MAX_TOTAL_WIDTH = 120;
    const MIN_COL_WIDTH = 5;
    const padding = 1;
    const borderOverhead = numCols + 1;
    const availableWidth = MAX_TOTAL_WIDTH - borderOverhead - (numCols * padding * 2);

    // Calculate natural widths based on content
    const naturalWidths = new Array(numCols).fill(MIN_COL_WIDTH);
    dataRows.forEach((row) => {
      row.forEach((cell, i) => {
        naturalWidths[i] = Math.max(naturalWidths[i] || 0, cell.length);
      });
    });

    // If natural widths fit within max, use them
    const totalNatural = naturalWidths.reduce((a, b) => a + b, 0);
    let colWidths;
    if (totalNatural <= availableWidth) {
      colWidths = naturalWidths;
    } else {
      // Distribute width proportionally, prioritizing columns with more content
      const totalUnits = naturalWidths.reduce((a, b) => a + b, 0);
      colWidths = naturalWidths.map((w) =>
        Math.max(MIN_COL_WIDTH, Math.floor((w / totalUnits) * availableWidth))
      );
      // Distribute any remaining space left by rounding
      let remaining = availableWidth - colWidths.reduce((a, b) => a + b, 0);
      let i = 0;
      while (remaining > 0) {
        colWidths[i % numCols] += 1;
        remaining -= 1;
        i += 1;
      }
    }

    // Pre-wrap all cells
    const wrappedRows = dataRows.map((row) =>
      row.map((cell, i) => this._wrapCellText(cell, colWidths[i]))
    );

    // Determine row heights (max lines per row)
    const rowHeights = wrappedRows.map((row) =>
      Math.max(...row.map((cells) => cells.length))
    );

    const makeSeparator = (left, mid, right, fill) =>
      left + colWidths.map((w) => fill.repeat(w + padding * 2)).join(mid) + right;

    const topBorder = makeSeparator("┌", "┬", "┐", "─");
    const midBorder = makeSeparator("├", "┼", "┤", "─");
    const bottomBorder = makeSeparator("└", "┴", "┘", "─");

    let output = `${topBorder}\n`;

    wrappedRows.forEach((row, rowIndex) => {
      for (let lineIdx = 0; lineIdx < rowHeights[rowIndex]; lineIdx++) {
        const cells = row.map((cellLines, colIdx) => {
          const line = cellLines[lineIdx] || "";
          return ` ${line.padEnd(colWidths[colIdx])} `;
        });
        output += `│${cells.join("│")}│\n`;
      }
      if (rowIndex === 0) output += `${midBorder}\n`;
    });

    output += bottomBorder;
    return `\n${output}\n`;
  }

  /**
   * Formats markdown text, including tables and code blocks, for terminal display.
   * @param {string} text - The markdown text to format.
   * @returns {string} The formatted text with ANSI colors.
   */
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

  /**
   * Renders a titled panel with a message and optional styling.
   * @param {string} title - The title of the panel.
   * @param {string} message - The message to display inside the panel.
   * @param {string} [style] - The style of the panel (e.g., "warning", "none").
   * @returns {string} The rendered panel string.
   */
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