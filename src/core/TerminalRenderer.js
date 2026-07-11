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
    "$\\rightarrow$": "→",
    "$\\leftarrow$": "←",
    "$\\Rightarrow$": "⇒",
    "$\\Leftarrow$": "⇐",
    "$\\leftrightarrow$": "↔",
    "$\\Leftrightarrow$": "⇔",
    "$\\mapsto$": "↦",
    "$\\uparrow$": "↑",
    "$\\downarrow$": "↓",
    "$\\Uparrow$": "⇑",
    "$\\Downarrow$": "⇓",
    "$\\updownarrow$": "↕",
    "$\\Updownarrow$": "⇕",
    // Set theory
    "$\\in$": "∈",
    "$\\notin$": "∉",
    "$\\subset$": "⊂",
    "$\\supset$": "⊃",
    "$\\subseteq$": "⊆",
    "$\\supseteq$": "⊇",
    "$\\cup$": "∪",
    "$\\cap$": "∩",
    "$\\emptyset$": "∅",
    "$\\varnothing$": "∅",
    // Logic
    "$\\forall$": "∀",
    "$\\exists$": "∃",
    "$\\nexists$": "∄",
    "$\\neg$": "¬",
    "$\\land$": "∧",
    "$\\lor$": "∨",
    "$\\oplus$": "⊕",
    "$\\otimes$": "⊗",
    // Relations
    "$\\leq$": "≤",
    "$\\geq$": "≥",
    "$\\neq$": "≠",
    "$\\approx$": "≈",
    "$\\equiv$": "≡",
    "$\\sim$": "∼",
    "$\\cong$": "≅",
    "$\\propto$": "∝",
    // Calculus / Algebra
    "$\\infty$": "∞",
    "$\\partial$": "∂",
    "$\\nabla$": "∇",
    "$\\sum$": "Σ",
    "$\\prod$": "Π",
    "$\\int$": "∫",
    "$\\oint$": "∮",
    "$\\pm$": "±",
    "$\\mp$": "∓",
    "$\\times$": "×",
    "$\\div$": "÷",
    "$\\cdot$": "·",
    // Ellipsis
    "$\\cdots$": "⋯",
    "$\\ldots$": "…",
    "$\\vdots$": "⋮",
    "$\\ddots$": "⋱",
    // Greek lowercase
    "$\\alpha$": "α",
    "$\\beta$": "β",
    "$\\gamma$": "γ",
    "$\\delta$": "δ",
    "$\\epsilon$": "ε",
    "$\\varepsilon$": "ϵ",
    "$\\zeta$": "ζ",
    "$\\eta$": "η",
    "$\\theta$": "θ",
    "$\\vartheta$": "ϑ",
    "$\\iota$": "ι",
    "$\\kappa$": "κ",
    "$\\lambda$": "λ",
    "$\\mu$": "μ",
    "$\\nu$": "ν",
    "$\\xi$": "ξ",
    "$\\pi$": "π",
    "$\\varpi$": "ϖ",
    "$\\rho$": "ρ",
    "$\\varrho$": "ϱ",
    "$\\sigma$": "σ",
    "$\\varsigma$": "ς",
    "$\\tau$": "τ",
    "$\\upsilon$": "υ",
    "$\\phi$": "φ",
    "$\\varphi$": "ϕ",
    "$\\chi$": "χ",
    "$\\psi$": "ψ",
    "$\\omega$": "ω",
    // Greek uppercase
    "$\\Gamma$": "Γ",
    "$\\Delta$": "Δ",
    "$\\Theta$": "Θ",
    "$\\Lambda$": "Λ",
    "$\\Xi$": "Ξ",
    "$\\Pi$": "Π",
    "$\\Sigma$": "Σ",
    "$\\Upsilon$": "Υ",
    "$\\Phi$": "Φ",
    "$\\Psi$": "Ψ",
    "$\\Omega$": "Ω",
    // Special
    "$\\hbar$": "ℏ",
    "$\\ell$": "ℓ",
    "$\\Re$": "ℜ",
    "$\\Im$": "ℑ",
    "$\\aleph$": "ℵ",
    // Nerd Font glyphs
    "[calendar]": "D",
    "[clock]": "",
    "[folder]": "",
    "[file]": "",
    "[code]": "",
    "[terminal]": "",
    "[check]": "",
    "[cross]": "",
    "[warning]": "",
    "[info]": "",
    "[gear]": "",
    "[bolt]": "",
    "[book]": "",
    "[pen]": "",
    "[bug]": "",
    "[star]": "",
    "[heart]": "",
    "[fire]": "",
    "[rocket]": "",
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
    result = result.replace(/\$\\sqrt\{([^}]+)\}\$/g, "√$1");
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
   * Calculates the visual display width of a string, accounting for
   * wide characters (CJK, fullwidth) and zero-width characters
   * (combining marks, variation selectors, ZWJ).
   * @param {string} text - The text to measure.
   * @returns {number} The visual width in terminal columns.
   */
  _visualWidth(text) {
    let width = 0;
    // eslint-disable-next-line no-control-regex
    const cleanText = text.replace(/\u001B\[[0-9;]*m/g, "");
    const chars = Array.from(cleanText);
    for (let i = 0; i < chars.length; i += 1) {
      const code = chars[i].codePointAt(0);
      // Zero-width: combining marks, variation selectors, ZWJ, soft hyphen
      const isZeroWidth =
        (code >= 0x0300 && code <= 0x036f) ||
        code === 0x200d ||
        (code >= 0xfe00 && code <= 0xfe0f) ||
        code === 0x00ad;

      // Wide: CJK, Hangul, fullwidth forms, etc.
      const isWide =
        (code >= 0x1100 && code <= 0x115f) ||
        (code >= 0x2e80 && code <= 0x303e) ||
        (code >= 0x3041 && code <= 0x33ff) ||
        (code >= 0x3400 && code <= 0x4dbf) ||
        (code >= 0x4e00 && code <= 0x9fff) ||
        (code >= 0xa000 && code <= 0xa4cf) ||
        (code >= 0xac00 && code <= 0xd7a3) ||
        (code >= 0xf900 && code <= 0xfaff) ||
        (code >= 0xfe30 && code <= 0xfe4f) ||
        (code >= 0xff00 && code <= 0xff60) ||
        (code >= 0xffe0 && code <= 0xffe6) ||
        (code >= 0x20000 && code <= 0x2fffd) ||
        (code >= 0x30000 && code <= 0x3fffd);

      if (isZeroWidth) {
        // eslint-disable-next-line no-continue
        continue;
      } else if (isWide) {
        width += 2;
      } else {
        width += 1;
      }
    }
    return width;
  }

  /**
   * Pads a string to a specified visual width with trailing spaces.
   * Unlike String.prototype.padEnd, this accounts for wide characters.
   * @param {string} text - The text to pad.
   * @param {number} width - The target visual width.
   * @returns {string} The padded string.
   */
  _padToWidth(text, width) {
    const current = this._visualWidth(text);
    if (current >= width) return text;
    return text + " ".repeat(width - current);
  }

  /**
   * Wraps a single string of text to fit within a specified visual width.
   * @param {string} text - The text to wrap.
   * @param {number} width - The maximum visual width in terminal columns.
   * @returns {string[]} An array of wrapped lines.
   */
  _wrapCellText(text, width) {
    if (this._visualWidth(text) <= width) return [text];
    const words = text.split(/\s+/);
    const lines = [];
    let currentLine = "";
    words.forEach((word) => {
      if (this._visualWidth(word) > width) {
        if (currentLine) lines.push(currentLine);
        // Hard-break long words by visual width, char by char
        let chunk = "";
        const wordChars = Array.from(word);
        for (let i = 0; i < wordChars.length; i += 1) {
          const ch = wordChars[i];
          if (this._visualWidth(chunk + ch) > width) {
            lines.push(chunk);
            chunk = ch;
          } else {
            chunk += ch;
          }
        }
        if (chunk) lines.push(chunk);
        currentLine = "";
      } else if (
        this._visualWidth(currentLine + (currentLine ? " " : "") + word) <=
        width
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
    const MAX_TOTAL_WIDTH = 115;
    const MIN_COL_WIDTH = 5;
    const padding = 1;
    const borderOverhead = numCols + 1;
    const availableWidth =
      MAX_TOTAL_WIDTH - borderOverhead - numCols * padding * 2;

    // Calculate natural widths based on content
    const naturalWidths = new Array(numCols).fill(MIN_COL_WIDTH);
    dataRows.forEach((row) => {
      row.forEach((cell, i) => {
        naturalWidths[i] = Math.max(
          naturalWidths[i] || 0,
          this._visualWidth(cell),
        );
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

    const topBorder = `┌${colWidths.map((w) => "─".repeat(w + padding * 2)).join("┬")}┐`;
    const midBorder = `├${colWidths.map((w) => "─".repeat(w + padding * 2)).join("┼")}┤`;
    const bottomBorder = `└${colWidths.map((w) => "─".repeat(w + padding * 2)).join("┴")}┘`;

    let output = `${topBorder}\n`;

    wrappedRows.forEach((row, rowIndex) => {
      for (let lineIdx = 0; lineIdx < rowHeights[rowIndex]; lineIdx += 1) {
        const cells = row.map((cellLines, colIdx) => {
          const line = cellLines[lineIdx] || "";
          return ` ${this._padToWidth(line, colWidths[colIdx])} `;
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
   * Translates LaTeX notation and bracket tokens to Unicode/Nerd Font glyphs.
   * @param {string} text - The markdown text to format.
   * @returns {string} The formatted text with ANSI colors.
   */
  formatMarkdown(text) {
    if (!text) return "";
    let formatted = this._translateSymbols(text);

    // Apply block and inline formatting BEFORE tables so tables can correctly calculate visual widths
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

    const tableRegex = /((?:^\s*\|.*\n?)+)/gm;
    formatted = formatted.replace(tableRegex, (match) =>
      this.renderTable(match),
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
    const border = "─".repeat(this._visualWidth(title) + 4);
    const panelColor = style === "warning" ? chalk.yellow : chalk.blue;
    let output = `\n${panelColor(`┌${border}┐`)}\n`;
    const paddedTitle = this._padToWidth(title, this._visualWidth(title));
    const paddedMsg = this._padToWidth(message, this._visualWidth(message));
    output += `${panelColor("│")} ${chalk.bold(paddedTitle)} ${panelColor(" ".repeat(border.length - this._visualWidth(title) - 2))} ${panelColor("│")}\n`;
    output += `${panelColor(`├${"─".repeat(border.length)}┤`)}\n`;
    output += `${panelColor("│")} ${paddedMsg} ${panelColor(" ".repeat(Math.max(0, border.length - this._visualWidth(message) - 2)))} ${panelColor("│")}\n`;
    output += `${panelColor(`└${border}┘`)}\n\n`;
    return output;
  }
}

export default new TerminalRenderer();
