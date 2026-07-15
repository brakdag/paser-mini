import chalk from "chalk";
import ora from "ora";
import renderer from "./TerminalRenderer.js";
import IRCFormatter from "../utils/ircFormatter.js";
import input from "./TerminalInput.js";
import sessionLogger from "./SessionLogger.js";
import IRCFormat from "../formats/IRCFormat.js";
import CleanFormat from "../formats/CleanFormat.js";
import FountainFormat from "../formats/FountainFormat.js";

/**
 * Icon used for tool monitoring spinners.
 * @type {string}
 */
const TOOL_ICON = "🛠️";

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
    this.user = { nickname: "user" };
    this.model = { nickname: "paser_mini" };
    this.renderingMode = "IRC";

    this.formatPlugins = {
      IRC: new IRCFormat(),
      CLEAN: new CleanFormat(),
      FOUNTAIN: new FountainFormat(),
    };
    this.activePlugin = this.formatPlugins.IRC;
    this.bashEnabled = false;
  }

  /**
   * Injects the command handler to allow non-blocking command execution.
   * @param {object} handler The command handler instance.
   */
  setCommandHandler(handler) {
    input.commandHandler = handler;
  }

  /**
   * Sets the rendering mode for the UI.
   * @param {string} mode The rendering mode to set (e.g., 'IRC', 'FOUNTAIN', 'CLEAN').
   */
  setRenderingMode(mode) {
    this.renderingMode = mode;
    this.activePlugin = this.formatPlugins[mode] || this.formatPlugins.IRC;
  }

  /**
   * Enables or disables bash mode.
   * @param {boolean} enabled The bash enablement state.
   */
  setBashEnabled(enabled) {
    this.bashEnabled = enabled;
  }

  /**
   * Sets the nickname for the user.
   * @param {string} nick The nickname of the user.
   */
  setUserNickname(nick) {
    this.userNickname = nick;
  }

  /**
   * Sets the agent nickname and propagates the change to the config.
   * @param {string} newNick The new nickname of the agent.
   * @param {object} [chatManager] The chat manager instance for persistence.
   */
  setAgentNickname(newNick, chatManager = null) {
    this.agentNickname = newNick;
    if (chatManager) {
      chatManager.configManager.save("agent_nickname", newNick);
    }
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
   * Formats a chat message using the active plugin.
   * @param {string} nickname The nickname of the sender.
   * @param {string} text The message text.
   * @returns {string} The formatted message string.
   */
  formatChatMessage(nickname, text) {
    return this.activePlugin.formatMessage(nickname, text);
  }

  /**
   * Formats a system message using the active plugin.
   * @param {string} text The system message text.
   * @returns {string} The formatted system message string.
   */
  formatSystemMessage(text) {
    return this.activePlugin.formatSystem(text);
  }

  /**
   * Sets the shared user and model identity objects.
   * @param {object} user The user identity object.
   * @param {object} model The model identity object.
   */
  setIdentities(user, model) {
    this.user = user;
    this.model = model;
  }

  /**
   * Displays a chat message in the terminal and logs it.
   * @param {string} nickname The nickname of the sender.
   * @param {string} text The message text.
   * @param {string} [timestamp] Optional override for the timestamp.
   */
  displayChatMessage(nickname, text, timestamp = null) {
    input.clearCurrentLine();
    const plainText = text.trim();
    const ts = timestamp || IRCFormatter.getTimestamp();
    
    // 1. Colored format for the terminal (with timestamp)
    const terminalText = IRCFormatter.formatTerminalMessage(nickname, plainText, this.model.nickname, ts);
    const renderedText = renderer.formatMarkdown(terminalText);
    process.stdout.write(`${renderedText}\n`);

    // 2. Plain format for the log (with timestamp)
    const logText = this.activePlugin.formatMessage(nickname, plainText, ts);
    this.writeToLog(logText);
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
    process.stdout.write(`${chalk.green.italic(`💭 ${text}`)}\n`);
  }

  /**
   * Displays an information message in the terminal.
   * @param {string} text The info message to display.
   */
  displayInfo(text) {
    input.clearCurrentLine();
    process.stdout.write(`${chalk.blue("ℹ ") + chalk.cyan(text)}\n`);
    this.writeToLog(this.activePlugin.formatSystem(`INFO: ${text}`));
  }

  /**
   * Displays an error message in the terminal.
   * @param {string} text The error message to display.
   */
  displayError(text) {
    input.clearCurrentLine();
    process.stdout.write(`${chalk.red("✖ ") + chalk.red.bold(text)}\n`);
    this.writeToLog(this.activePlugin.formatSystem(`ERROR: ${text}`));
  }

  /**
   * Displays a system message by routing it through displayChatMessage.
   * @param {string} text The system message to display.
   */
  displaySystemMessage(text) {
    this.displayChatMessage("system", `*** ${text}`);
  }

  /**
   * Displays a formatted info panel in the terminal.
   * @param {string} title The title of the panel.
   * @param {Array<[string, string]>} data The key-value pairs to display.
   */
  displayInfoPanel(title, data) {
    const renderedPanel = renderer.renderInfoPanel(title, data);
    process.stdout.write(renderedPanel);
  }

  /**
   * Displays a formatted menu panel with indexed options.
   * @param {string} title The title of the menu.
   * @param {string[]} items The list of options to display.
   */
  displayMenu(title, items) {
    const renderedMenu = renderer.renderMenu(title, items);
    process.stdout.write(renderedMenu);
  }

  /**
   * Displays a generic formatted panel in the terminal.
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
    const msg = `${TOOL_ICON} ${name} (${detail})...`;
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
    input.clearCurrentLine();
    const statusIcon = success ? "✓" : "✗";
    const statusColor = success ? chalk.green : chalk.red;
    const ts = IRCFormatter.getTimestamp();

    const actionText = `* ${name} (${detail})`;

    // 1. Colored message for the terminal (with timestamp and status)
    const terminalText = IRCFormatter.formatTerminalAction(this.model.nickname, actionText, statusColor(statusIcon), ts);
    process.stdout.write(`${terminalText}\n`);

    // 2. Plain message for the log (with timestamp and status)
    this.writeToLog(
      this.activePlugin.formatAction(this.model.nickname, `${actionText} ${statusIcon}`),
    );
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