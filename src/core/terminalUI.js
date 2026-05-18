import chalk from "chalk";
import ora from "ora";

import renderer from "./TerminalRenderer.js";
import input from "./TerminalInput.js";
import sessionLogger from "./SessionLogger.js";

class TerminalUI {
  constructor() {
    this.noSpinner = true;
    this.activeSpinners = new Map();
    this.agentNickname = "paser_mini";
    this.userNickname = "user";
    this.renderingMode = "IRC";
  }

  setRenderingMode(mode) {
    this.renderingMode = mode;
  }

  writeToLog(text) {
    sessionLogger.writeToLog(text);
  }

  formatMarkdown(text) {
    return renderer.formatMarkdown(text);
  }

  displayChatMessage(nickname, text) {
    input.clearCurrentLine();
    const trimmedText = text.trim();

    if (this.renderingMode === "FOUNTAIN") {
      const fountainText = renderer.renderFountain(nickname, trimmedText);
      const renderedText = renderer.formatMarkdown(fountainText);
      process.stdout.write(`${renderedText}\n`);
      this.writeToLog(renderedText);
      return;
    }

    if (this.renderingMode === "CLEAN") {
      const renderedText = renderer.formatMarkdown(trimmedText);
      process.stdout.write(`${renderedText}\n`);
      const now = new Date();
      const time = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
      this.writeToLog(`[${time}] <${nickname}> ${trimmedText}`);
      return;
    }

    const renderedText = renderer.formatMarkdown(trimmedText);
    const now = new Date();
    const time = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

    if (trimmedText.startsWith("---") || trimmedText.startsWith("***") || trimmedText.startsWith("-!-")) {
      const formatted = `[${time}] ${trimmedText}`;
      process.stdout.write(`${chalk.white(`[${time}]`)} ${renderedText}\n`);
      this.writeToLog(formatted);
    } else {
      const nameColor = nickname === this.agentNickname ? chalk.cyan : chalk.green;
      const formatted = `[${time}] <${nickname}> ${trimmedText}`;
      const prefix = `[${time}] <${nameColor(nickname)}>`;
      process.stdout.write(`${prefix} ${renderedText}\n`);
      this.writeToLog(formatted);
    }
  }

  displayMessage(text) {
    process.stdout.write(`${renderer.formatMarkdown(text)}\n`);
  }

  displayThought(text) {
    input.clearCurrentLine();
    process.stdout.write(`${chalk.green.italic(`\ud83d\udcad ${text}`)}\n`);
  }

  displayInfo(text) {
    input.clearCurrentLine();
    const now = new Date();
    const time = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    process.stdout.write(`${chalk.blue("\u2139 ") + chalk.cyan(text)}\n`);
    this.writeToLog(`[${time}] [INFO] ${text}`);
  }

  displayError(text) {
    input.clearCurrentLine();
    const now = new Date();
    const time = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    process.stdout.write(`${chalk.red("\u2716 ") + chalk.red.bold(text)}\n`);
    this.writeToLog(`[${time}] [ERROR] ${text}`);
  }

  displaySystemMessage(text) {
    this.displayChatMessage("system", `*** ${text}`);
  }

  displayPanel(title, message, style = "none") {
    process.stdout.write(renderer.renderPanel(title, message, style));
  }

  startToolMonitoring(name, detail) {
    const toolIcon = "\ud83d\udee0\ufe0f";
    const msg = `${toolIcon} ${name} (${detail})...`;
    if (this.noSpinner) {
      return;
    }
    const spinner = ora({ text: chalk.yellow(msg), color: "yellow" }).start();
    this.activeSpinners.set(name, spinner);
  }

  updateMonitoring(name, text) {
    const spinner = this.activeSpinners.get(name);
    if (spinner) spinner.text = text;
  }

  displayToolStatus(name, success, detail) {
    const now = new Date();
    const time = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
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
      this.writeToLog(renderer.renderFountain("system", `* ACTION: ${cleanToolLog}`));
    } else {
      this.writeToLog(`${plainPrefix} * ${name} (${detail}) ${plainStatus}`);
    }
  }

  endToolMonitoring(name, success, detail) {
    const spinner = this.activeSpinners.get(name);
    if (spinner) spinner.stop();
    this.displayToolStatus(name, success, detail);
    if (spinner) this.activeSpinners.delete(name);
  }

  stopAllMonitoring() {
    this.activeSpinners.forEach((spinner) => spinner.stop());
    this.activeSpinners.clear();
  }

  clear() {
    process.stdout.write("\x1Bc");
  }

  initInput() {
    input.init();
  }

  requestInput(prompt = "> ") {
    return input.requestInput(prompt);
  }

  async getConfirmation(message) {
    return input.getConfirmation(message);
  }

  getLogOpenedString() {
    const now = new Date();
    const datePart = now.toDateString();
    const timePart = now.toTimeString().split(" ")[0];
    const [dayName, month, day, year] = datePart.split(" ");
    return `--- Log opened ${dayName} ${month} ${day} ${timePart} ${year} resumed from ./log/session.log`;
  }

  displayLogOpened() {
    this.displayChatMessage("user", this.getLogOpenedString());
  }
}

export default TerminalUI;