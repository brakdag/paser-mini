import chalk from "chalk";
import ora from "ora";
import fs from "fs";
import readline from "readline";

class TerminalUI {
  // eslint-disable-next-line no-unused-vars
  constructor(options = {}) {
    this.noSpinner = true; // Forced to true to prevent TTY crashes during tool execution
    this.activeSpinners = new Map();

    this.agentNickname = "paser_mini";
    this.userNickname = "user";
    this.renderingMode = "IRC"; // 'IRC' or 'FOUNTAIN'
    this.inputQueue = [];
    this.rl = null;
    this.inputResolver = null;
  }

  setRenderingMode(mode) {
    this.renderingMode = mode;
  }

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

  _renderFountain(nickname, text) {
    const trimmedText = text.trim();
    let output = "";

    if (nickname === "system") {
      // Scene Heading or Action
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
      // Dialogue without nickname
      if (trimmedText.startsWith("*")) {
        const cleanText = trimmedText.replace(/^\*\s*|\s*\*$/g, "");
        output += this._wrapText(`(${cleanText})`, 31, 60);
      } else {
        output += this._wrapText(trimmedText, 25, 60);
      }
    } else {
      // Character and Dialogue/Parenthetical
      output += `${" ".repeat(37) + nickname.toUpperCase()}\n`;

      if (trimmedText.startsWith("*")) {
        // Parenthetical
        const cleanText = trimmedText.replace(/^\*\s*|\s*\*$/g, "");
        output += this._wrapText(`(${cleanText})`, 31, 60);
      } else {
        // Dialogue
        output += this._wrapText(trimmedText, 25, 60);
      }
    }
    return output;
  }

  writeToLog(text) {
    try {
      fs.appendFileSync("session.log", `${text}\n`, "utf8");

      // Immediate persistence for system events (-!-)
      if (text.includes("-!-")) {
        fs.appendFileSync("session_history.log", `${text}\n`, "utf8");
      }
    } catch (e) {
      console.error(`[Log Error] ${e.message}`);
    }
  }

  clearLog() {
    try {
      if (fs.existsSync("session.log")) {
        const content = fs.readFileSync("session.log", "utf8");
        if (content) {
          fs.appendFileSync("session_history.log", `${content}\n`, "utf8");
        }
      }
      fs.writeFileSync("session.log", "", "utf8");
    } catch (e) {
      console.error(`[Log Error] ${e.message}`);
    }
  }

  /**
   * Renderiza una tabla de Markdown en formato de terminal
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

  /**
   * Formatea texto Markdown básico usando chalk para la terminal
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
      (_, code) => `\n${chalk.gray(code.trim())}\n`,
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

  formatChatMessage(nickname, text, time = null) {
    const t =
      time ||
      new Date().toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
      });
    return `[${t}] <${nickname}> ${text}`;
  }

  displayChatMessage(nickname, text) {
    this._clearCurrentLine();
    const trimmedText = text.trim();

    if (this.renderingMode === "FOUNTAIN") {
      const fountainText = this._renderFountain(nickname, trimmedText);
      const renderedText = this.formatMarkdown(fountainText);
      process.stdout.write(`${renderedText}\n`);

      // Log the actual rendered layout to preserve the screenplay structure
      this.writeToLog(renderedText);
      this._restorePrompt();
      return;
    }

    if (this.renderingMode === "CLEAN") {
      const renderedText = this.formatMarkdown(trimmedText);
      process.stdout.write(`${renderedText}\n`);

      const now = new Date();
      const time = now.toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
      });
      this.writeToLog(`[${time}] <${nickname}> ${trimmedText}`);

      this._restorePrompt();
      return;
    }

    const renderedText = this.formatMarkdown(trimmedText);
    const now = new Date();
    const time = now.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    });

    if (
      trimmedText.startsWith("---") ||
      trimmedText.startsWith("***") ||
      trimmedText.startsWith("-!-")
    ) {
      const formatted = `[${time}] ${trimmedText}`;
      process.stdout.write(`${chalk.white(`[${time}]`)} ${renderedText}\n`);
      this.writeToLog(formatted);
    } else {
      const nameColor =
        nickname === this.agentNickname ? chalk.cyan : chalk.green;
      const formatted = `[${time}] <${nickname}> ${trimmedText}`;
      const prefix = `[${time}] <${nameColor(nickname)}>`;
      process.stdout.write(`${prefix} ${renderedText}\n`);
      this.writeToLog(formatted);
    }
    this._restorePrompt();
  }

  _clearCurrentLine() {
    if (this.rl) {
      process.stdout.write("\r\x1b[K");
    }
  }

  _restorePrompt() {
    // Removed rl.prompt to prevent redundant calls and potential terminal crashes
  }

  getLogOpenedString() {
    const now = new Date();
    const datePart = now.toDateString();
    const timePart = now.toTimeString().split(" ")[0];
    const [dayName, month, day, year] = datePart.split(" ");
    return `--- Log opened ${dayName} ${month} ${day} ${timePart} ${year} * Session resumed from ./log/history.log`;
  }

  displayLogOpened() {
    const logMsg = this.getLogOpenedString();
    this.displayChatMessage("user", logMsg);
  }

  displayMessage(text) {
    const renderedText = this.formatMarkdown(text);
    process.stdout.write(`${renderedText}\n`);
  }

  displayThought(text) {
    this._clearCurrentLine();
    process.stdout.write(`${chalk.green.italic(`\ud83d\udcad ${text}`)}\n`);
    this._restorePrompt();
  }

  // eslint-disable-next-line class-methods-use-this
  displayInfo(text) {
    this._clearCurrentLine();
    const now = new Date();
    const time = now.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    });
    process.stdout.write(`${chalk.blue("\u2139 ") + chalk.cyan(text)}\n`);
    this.writeToLog(`[${time}] [INFO] ${text}`);
    this._restorePrompt();
  }

  // eslint-disable-next-line class-methods-use-this
  displayError(text) {
    this._clearCurrentLine();
    const now = new Date();
    const time = now.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    });
    process.stdout.write(`${chalk.red("\u2716 ") + chalk.red.bold(text)}\n`);
    this.writeToLog(`[${time}] [ERROR] ${text}`);
    this._restorePrompt();
  }

  displaySystemMessage(text) {
    this.displayChatMessage("system", `*** ${text}`);
  }

  displayPanel(title, message, style = "none") {
    const border = "\u2500".repeat(title.length + 4);
    const panelColor = style === "warning" ? chalk.yellow : chalk.blue;

    process.stdout.write(`\n${panelColor(`\u250c${border}\u2510`)}\n`);
    process.stdout.write(
      `${panelColor("\u2502")} ${chalk.bold(title)} ${panelColor(
        " ".repeat(border.length - title.length - 2),
      )} ${panelColor("\u2502")}\n`,
    );
    process.stdout.write(
      `${panelColor(`\u251c${"\u2500".repeat(border.length)}\u2524`)}\n`,
    );
    process.stdout.write(
      `${panelColor("\u2502")} ${message} ${panelColor(
        " ".repeat(Math.max(0, border.length - message.length - 2)),
      )} ${panelColor("\u2502")}\n`,
    );
    process.stdout.write(`${panelColor(`\u2514${border}\u2518`)}\n\n`);
  }

  // eslint-disable-next-line no-unused-vars
  startToolMonitoring(_name, _detail) {
    const toolIcon = "\ud83d\udee0\ufe0f"; // \ud83d\udee0\ufe0f
    const msg = `${toolIcon} ${_name} (${_detail})...`;

    if (this.noSpinner) {
      process.stdout.write(`${chalk.yellow(msg)}\n`);
      return;
    }

    const spinner = ora({
      text: chalk.yellow(msg),
      color: "yellow",
    }).start();

    this.activeSpinners.set(_name, spinner);
  }

  updateMonitoring(name, text) {
    const spinner = this.activeSpinners.get(name);
    if (spinner) {
      spinner.text = text;
    }
  }

  displayToolStatus(name, success, detail) {
    const now = new Date();
    const time = now.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    });
    const nameColor = chalk.cyan;
    const statusIcon = success ? "✓" : "✗";
    const statusColor = success ? chalk.green : chalk.red;
    const prefix = `[${time}] <${nameColor(this.agentNickname)}>`;
    const finalMsg = `${prefix} * ${name} (${detail}) ${statusColor(statusIcon)}`;

    console.log(finalMsg);
    const plainStatus = success ? "✓" : "✗";
    const plainPrefix = `[${time}] <${this.agentNickname}>`;
    if (this.renderingMode === "FOUNTAIN") {
      const cleanToolLog = `${name} (${detail}) ${plainStatus}`;
      this.writeToLog(
        this._renderFountain("system", `* ACTION: ${cleanToolLog}`),
      );
    } else {
      this.writeToLog(`${plainPrefix} * ${name} (${detail}) ${plainStatus}`);
    }
  }

  endToolMonitoring(name, success, detail) {
    const spinner = this.activeSpinners.get(name);
    if (spinner) {
      spinner.stop();
    }

    this.displayToolStatus(name, success, detail);

    if (spinner) {
      this.activeSpinners.delete(name);
    }
  }

  stopAllMonitoring() {
    this.activeSpinners.forEach((spinner) => spinner.stop());
    this.activeSpinners.clear();
  }

  clear() {
    process.stdout.write("\x1Bc");
  }

  initInput() {
    if (this.rl) return;
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
    });

    this.rl.on("line", (line) => {
      const trimmed = line.trim();
      if (trimmed) {
        if (this.inputResolver) {
          const resolve = this.inputResolver;
          this.inputResolver = null;
          resolve(trimmed);
        } else {
          this.inputQueue.push(trimmed);
        }
      }
    });
  }

  // eslint-disable-next-line no-unused-vars
  requestInput(prompt = "> ") {
    if (this.inputQueue.length > 0) {
      const input = this.inputQueue.shift();
      process.stdout.write(prompt);
      return input;
    }

    return new Promise((resolve) => {
      this.inputResolver = resolve;
      process.stdout.write(prompt);
    });
  }

  async getConfirmation(message) {
    const answer = await this.requestInput(`${message} [y/N] \u276f `);
    return answer.toLowerCase() === "y";
  }
}


export default TerminalUI;
