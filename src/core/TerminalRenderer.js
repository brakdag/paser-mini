import chalk from "chalk";

/**
 * Handles the rendering of text, tables, and panels to the terminal with specific formatting.
 */
class TerminalRenderer {
  /**
   * Symbol translation map: LaTeX notation and common tokens to Unicode/Nerd Font glyphs.
   * @private
   * @type {Record<string, string>}
   */
  _symbolMap = {
    // Arrows
    "$\\rightarrow$": "\u2192",
    "$\\leftarrow$": "\u2190",
    "$\\Rightarrow$": "\u21D2",
    "$\\Leftarrow$": "\u21D0",
    "$\\leftrightarrow$": "\u2194",
    "$\\Leftrightarrow$": "\u21D4",
    "$\\mapsto$": "\u21A6",
    "$\\uparrow$": "\u2191",
    "$\\downarrow$": "\u2193",
    "$\\Uparrow$": "\u21D1",
    "$\\Downarrow$": "\u21D3",
    "$\\updownarrow$": "\u2195",
    "$\\Updownarrow$": "\u21D5",
    // Set theory
    "$\\in$": "\u2208",
    "$\\notin$": "\u2209",
    "$\\subset$": "\u2282",
    "$\\supset$": "\u2283",
    "$\\subseteq$": "\u2286",
    "$\\supseteq$": "\u2287",
    "$\\cup$": "\u222A",
    "$\\cap$": "\u2229",
    "$\\emptyset$": "\u2205",
    "$\\varnothing$": "\u2205",
    // Logic
    "$\\forall$": "\u2200",
    "$\\exists$": "\u2203",
    "$\\nexists$": "\u2204",
    "$\\neg$": "\u00AC",
    "$\\land$": "\u2227",
    "$\\lor$": "\u2228",
    "$\\oplus$": "\u2295",
    "$\\otimes$": "\u2297",
    // Relations
    "$\\leq$": "\u2264",
    "$\\geq$": "\u2265",
    "$\\neq$": "\u2260",
    "$\\approx$": "\u2248",
    "$\\equiv$": "\u2261",
    "$\\sim$": "\u223C",
    "$\\cong$": "\u2245",
    "$\\propto$": "\u221D",
    // Calculus / Algebra
    "$\\infty$": "\u221E",
    "$\\partial$": "\u2202",
    "$\\nabla$": "\u2207",
    "$\\sum$": "\u03A3",
    "$\\prod$": "\u03A0",
    "$\\int$": "\u222B",
    "$\\oint$": "\u222E",
    "$\\pm$": "\u00B1",
    "$\\mp$": "\u2213",
    "$\\times$": "\u00D7",
    "$\\div$": "\u00F7",
    "$\\cdot$": "\u00B7",
    // Ellipsis
    "$\\cdots$": "\u22EF",
    "$\\ldots$": "\u2026",
    "$\\vdots$": "\u22EE",
    "$\\ddots$": "\u22F1",
    // Greek lowercase
    "$\\alpha$": "\u03B1",
    "$\\beta$": "\u03B2",
    "$\\gamma$": "\u03B3",
    "$\\delta$": "\u03B4",
    "$\\epsilon$": "\u03B5",
    "$\\varepsilon$": "\u03F5",
    "$\\zeta$": "\u03B6",
    "$\\eta$": "\u03B7",
    "$\\theta$": "\u03B8",
    "$\\vartheta$": "\u03D1",
    "$\\iota$": "\u03B9",
    "$\\kappa$": "\u03BA",
    "$\\lambda$": "\u03BB",
    "$\\mu$": "\u03BC",
    "$\\nu$": "\u03BD",
    "$\\xi$": "\u03BE",
    "$\\pi$": "\u03C0",
    "$\\varpi$": "\u03D6",
    "$\\rho$": "\u03C1",
    "$\\varrho$": "\u03F1",
    "$\\sigma$": "\u03C3",
    "$\\varsigma$": "\u03C2",
    "$\\tau$": "\u03C4",
    "$\\upsilon$": "\u03C5",
    "$\\phi$": "\u03C6",
    "$\\varphi$": "\u03D5",
    "$\\chi$": "\u03C7",
    "$\\psi$": "\u03C8",
    "$\\omega$": "\u03C9",
    // Greek uppercase
    "$\\Gamma$": "\u0393",
    "$\\Delta$": "\u0394",
    "$\\Theta$": "\u0398",
    "$\\Lambda$": "\u039B",
    "$\\Xi$": "\u039E",
    "$\\Pi$": "\u03A0",
    "$\\Sigma$": "\u03A3",
    "$\\Upsilon$": "\u03A5",
    "$\\Phi$": "\u03A6",
    "$\\Psi$": "\u03A8",
    "$\\Omega$": "\u03A9",
    // Special
    "$\\hbar$": "\u210F",
    "$\\ell$": "\u2113",
    "$\\Re$": "\u211C",
    "$\\Im$": "\u2111",
    "$\\aleph$": "\u2135",
    // Nerd Font glyphs
    "[calendar]": "\uF00ED",
    "[clock]": "\uF43A",
    "[folder]": "\uF07C",
    "[file]": "\uF15B",
    "[code]": "\uF121",
    "[terminal]": "\uF07B",
    "[check]": "\uF00C",
    "[cross]": "\uF00D",
    "[warning]": "\uF071",
    "[info]": "\uF05A",
    "[gear]": "\uF013",
    "[bolt]": "\uF0E7",
    "[book]": "\uF02D",
    "[pen]": "\uF303",
    "[bug]": "\uF188",
    "[star]": "\uF005",
    "[heart]": "\uF004",
    "[fire]": "\uF06D",
    "[rocket]": "\uF135",
  };

  /**
   * Translates LaTeX notation and bracket tokens to Unicode/Nerd Font glyphs.
   * @private
   * @param {string} text - The text to translate.
   * @returns {string} The text with symbols replaced.
   */
  _translateSymbols(text) {
    let result = text;
    // Replace $\sqrt{...}$ → √...
    result = result.replace(/\$\\sqrt\{([^}]+)\}\$/g, "\u221A$1");
    // Replace all mapped symbols
    Object.entries(this._symbolMap).forEach(([latex, unicode]) => {
      const escapedKey = latex.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      result = result.replace(new RegExp(escapedKey, "g"), unicode);
    });
    return result;
  }

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
      } else if (
        (currentLine + (currentLine ? " " : "") + word).length <= width
      ) {
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
    const availableWidth =
      MAX_TOTAL_WIDTH - borderOverhead - numCols * padding * 2;

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
        Math.max(MIN_COL_WIDTH, Math.floor((w / totalUnits) * availableWidth)),
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
      row.map((cell, i) => this._wrapCellText(cell, colWidths[i])),
    );

    // Determine row heights (max lines per row)
    const rowHeights = wrappedRows.map((row) =>
      Math.max(...row.map((cells) => cells.length)),
    );

  /**
   * Builds a separator line using Unicode box-drawing characters.
   * @private
   * @param {string} left - Left border character.
   * @param {string} mid - Middle border character.
   * @param {string} right - Right border character.
   * @param {string} fill - Fill character for column width.
   * @returns {string} The constructed separator line.
   */
  const makeSeparator = (left, mid, right, fill) =>
      left +
      colWidths.map((w) => fill.repeat(w + padding * 2)).join(mid) +
      right;

    const topBorder = makeSeparator("\u250C", "\u252C", "\u2510", "\u2500");
    const midBorder = makeSeparator("\u251C", "\u253C", "\u2524", "\u2500");
    const bottomBorder = makeSeparator("\u2514", "\u2534", "\u2518", "\u2500");

    let output = `${topBorder}\n`;

    wrappedRows.forEach((row, rowIndex) => {
      for (let lineIdx = 0; lineIdx < rowHeights[rowIndex]; lineIdx += 1) {
        const cells = row.map((cellLines, colIdx) => {
          const line = cellLines[lineIdx] || "";
          return ` ${line.padEnd(colWidths[colIdx])} `;
        });
        output += `\u2502${cells.join("\u2502")}\u2502\n`;
      }
      if (rowIndex === 0) output += `${midBorder}\n`;
    });

    output += bottomBorder;
    return `\n${output}\n`;
  }

  /**
   * Formats markdown text, including tables and code blocks, for terminal display.
   * Translates LaTeX notation and bracket tokens to Unicode/Nerd Font glyphs.
   * @param {string} text - The markdown text to format.
   * @returns {string} The formatted text with ANSI colors.
   */
  formatMarkdown(text) {
    if (!text) return "";
    let formatted = this._translateSymbols(text);
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
    let output = `\n${panelColor(`\u250C${border}\u2510`)}\n`;
    output += `${panelColor("\u2502")} ${chalk.bold(title)} ${panelColor(" ".repeat(border.length - title.length - 2))} ${panelColor("\u2502")}\n`;
    output += `${panelColor(`\u251C${"\u2500".repeat(border.length)}\u2524`)}\n`;
    output += `${panelColor("\u2502")} ${message} ${panelColor(" ".repeat(Math.max(0, border.length - message.length - 2)))} ${panelColor("\u2502")}\n`;
    output += `${panelColor(`\u2514${border}\u2518`)}\n\n`;
    return output;
  }
}

export default new TerminalRenderer();
