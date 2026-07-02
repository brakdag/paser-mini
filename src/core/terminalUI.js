import chalk from "chalk";
import ora from "ora";

import renderer from "./TerminalRenderer.js";
import input from "./TerminalInput.js";
import sessionLogger from "./SessionLogger.js";
import IRCFormatter from "../utils/ircFormatter.js";

/**
 * Manages the terminal user interface, including message display, 
 * tool monitoring, and input handling.
 */
class TerminalUI {
  /**
   * Gets the current input queue from the TerminalInput module.
   * @returns {Array} The queue of pending inputs.
   */
  get inputQueue() {
    return input.inputQueue;
  }

  /**
   * Initializes the TerminalUI instance with default settings.
   */
  constructor() {
    this.noSpinner = true;
    this.activeSpinners = new Map();
    this.agentNickname = "paser_mini";
    this.userNickname = "user";
    this.renderingMode = "IRC";

    this.bashEnabled = false;
  }

  /**
   * Sets the rendering mode for the UI.
   * @param {string} mode The rendering mode to set (e.g., 'IRC', 'FOUNTAIN', 'CLEAN').
   */
  setRenderingMode(mode) {
    this.renderingMode = mode;
  }

  /**
   * Enables or disables bash mode.
   */
  setBashEnabled() {}

  /**
   * Sets the nickname for the user.
   * @param {string} nick The nickname of the user.
   */
  setUserNickname(nick) {
    this.userNickname = nick;
  }

  /**
   * Writes a message to the session log.
   * @param {string} text The text to write to the log.
   */
  writeToLog(text) {
    sessionLogger.writeToLog(text);
  }

  /**
   * Formats markdown text using the TerminalRenderer.
   * @param {string} text The markdown text to format.
   * @returns {string} The formatted markdown text.
   */
  formatMarkdown(text) {
    return renderer.formatMarkdown(text);
  }

  /**
   * Displays a chat message in the terminal and logs it.
   * @param {string} nickname The nickname of the sender.
   * @param {string} text The message text.
   */
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
      this.writeToLog(IRCFormatter.formatMessage(nickname, trimmedText));
      return;
    }

    const renderedText = renderer.formatMarkdown(trimmedText);

    if (
      trimmedText.startsWith("---") ||
      trimmedText.startsWith("***") ||
      trimmedText.startsWith("-!-")
    ) {
      const formatted = `[${IRCFormatter.getTimestamp()}] ${trimmedText}`;
      process.stdout.write(
        `${chalk.white(`[${IRCFormatter.getTimestamp()}]`)} ${renderedText}\n`,
      );
      this.writeToLog(formatted);
    } else {
      const formatted = IRCFormatter.formatMessage(nickname, trimmedText);
      const terminalMsg = IRCFormatter.formatTerminalMessage(
        nickname,
        renderedText,
        this.agentNickname,
      );
      process.stdout.write(`${terminalMsg}\n`);
      this.writeToLog(formatted);
    }
  }

  /**
   * Displays a plain message in the terminal.
   * @param {string} text The message to display.
   */
  displayMessage(text) {
    process.stdout.write(`${renderer.formatMarkdown(text)}\n`);
  }

  /**
   * Displays a thought message in a specific style.
   * @param {string} text The thought text to display.
   */
  displayThought(text) {
    input.clearCurrentLine();
    process.stdout.write(`${chalk.green.italic(`\ud83d\udcad ${text}`)}\n`);
  }

  /**
   * Displays an information message in the terminal.
   * @param {string} text The info message to display.
   */
  displayInfo(text) {
    input.clearCurrentLine();
    process.stdout.write(`${chalk.blue("\u2139 ") + chalk.cyan(text)}\n`);
    this.writeToLog(IRCFormatter.formatSystemMessage("INFO", text));
  }

  /**
   * Displays an error message in the terminal.
   * @param {string} text The error message to display.
   */
  displayError(text) {
    input.clearCurrentLine();
    process.stdout.write(`${chalk.red("\u2716 ") + chalk.red.bold(text)}\n`);
    this.writeToLog(IRCFormatter.formatSystemMessage("ERROR", text));
  }

  /**
   * Displays a system message by routing it through displayChatMessage.
   * @param {string} text The system message to display.
   */
  displaySystemMessage(text) {
    this.displayChatMessage("system", `*** ${text}`);
  }

  /**
   * Displays a formatted panel in the terminal.
   * @param {string} title The title of the panel.
   * @param {string} message The content of the panel.
   * @param {string} [style] The style of the panel.
   */
  displayPanel(title, message, style = "none") {
    process.stdout.write(renderer.renderPanel(title, message, style));
  }

  /**
   * Starts a spinner for tool monitoring.
   * @param {string} name The name of the tool being monitored.
   * @param {string} detail The detail of the operation.
   */
  startToolMonitoring(name, detail) {
    const toolIcon = "\ud83d\udee0\ufe0f";
    const msg = `${toolIcon} ${name} (${detail})...`;
    if (this.noSpinner) {
      return;
    }
    const spinner = ora({ text: chalk.yellow(msg), color: "yellow" }).start();
    this.activeSpinners.set(name, spinner);
  }

  /**
   * Updates the text of an active tool monitoring spinner.
   * @param {string} name The name of the tool.
   * @param {string} text The updated status text.
   */
  updateMonitoring(name, text) {
    const spinner = this.activeSpinners.get(name);
    if (spinner) spinner.text = text;
  }

  /**
   * Displays the final status of a tool operation.
   * @param {string} name The name of the tool.
   * @param {boolean} success Whether the operation was successful.
   * @param {string} detail The detail of the operation.
   */
  displayToolStatus(name, success, detail) {
    const nameColor = chalk.cyan;
    const statusIcon = success ? "✓" : "✗";
    const statusColor = success ? chalk.green : chalk.red;

    const timestamp = IRCFormatter.getTimestamp();
    const prefix = `[${timestamp}] <${nameColor(this.agentNickname)}>`;
    const finalMsg = `${prefix} * ${name} (${detail}) ${statusColor(statusIcon)}`;
    console.log(finalMsg);

    const plainStatus = success ? "✓" : "✗";
    const plainPrefix = `[${timestamp}] <${this.agentNickname}>`;
    if (this.renderingMode === "FOUNTAIN") {
      const cleanToolLog = `${name} (${detail}) ${plainStatus}`;
      this.writeToLog(
        renderer.renderFountain("system", `* ACTION: ${cleanToolLog}`),
      );
    } else {
      this.writeToLog(`${plainPrefix} * ${name} (${detail}) ${plainStatus}`);
    }
  }

  /**
   * Stops the monitoring spinner and displays the final status.
   * @param {string} name The name of the tool.
   * @param {boolean} success Whether the operation was successful.
   * @param {string} detail The detail of the operation.
   */
  endToolMonitoring(name, success, detail) {
    const spinner = this.activeSpinners.get(name);
    if (spinner) spinner.stop();
    this.displayToolStatus(name, success, detail);
    if (spinner) this.activeSpinners.delete(name);
  }

  /**
   * Stops all active monitoring spinners and clears the map.
   */
  stopAllMonitoring() {
    this.activeSpinners.forEach((spinner) => spinner.stop());
    this.activeSpinners.clear();
  }

  /**
   * Clears the terminal screen.
   */
  clear() {
    process.stdout.write("\x1Bc");
  }

  /**
   * Initializes the terminal input handler.
   */
  initInput() {
    input.init();
  }

  /**
   * Requests input from the user with a given prompt.
   * @param {string} [prompt] The prompt to display.
   * @returns {Promise<string>} The user's input string.
   */
  requestInput(prompt = "> ") {
    return input.requestInput(prompt);
  }

  /**
   * Requests a yes/no confirmation from the user.
   * @param {string} message The confirmation message.
   * @returns {Promise<boolean>} True if confirmed, false otherwise.
   */
  async getConfirmation(message) {
    return input.getConfirmation(message);
  }

  /**
   * Generates the log session resumption string.
   * @returns {string} The formatted log opened string.
   */
  getLogOpenedString() {
    const now = new Date();
    const datePart = now.toDateString();
    const [, month, day, year] = datePart.split(" ");
    return `--- Log ${month} ${day} ${year} San Rafael Mendoza Argentina resumed from ./log/session.log`;
  }

  /**
   * Displays the log opened message in the terminal.
   */
  displayLogOpened() {
    this.displayChatMessage("user", this.getLogOpenedString());
  }
}

export default TerminalUI;