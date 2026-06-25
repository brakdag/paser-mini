import RendererStrategy from "./RendererStrategy.js";
import IRCFormatter from "../../utils/ircFormatter.js";
import terminalRenderer from "../TerminalRenderer.js";
import chalk from "chalk";

export default class CleanRenderer extends RendererStrategy {
  displayChatMessage(nickname, text) {
    const trimmedText = text.trim();
    const renderedText = terminalRenderer.formatMarkdown(trimmedText);
    process.stdout.write(`${renderedText}\n`);
    this.ui.writeToLog(IRCFormatter.formatMessage(nickname, trimmedText));
  }

  displayToolStatus(name, success, detail) {
    // We can reuse the IRC logging but maybe no prefix or simplify it?
    // Using the same logging as IRC for tools since terminalUI didn't distinguish for tools
    const nameColor = chalk.cyan;
    const statusIcon = success ? "✓" : "✗";
    const statusColor = success ? chalk.green : chalk.red;

    const timestamp = IRCFormatter.getTimestamp();
    const prefix = `[${timestamp}] <${nameColor(this.ui.agentNickname)}>`;
    const finalMsg = `${prefix} * ${name} (${detail}) ${statusColor(statusIcon)}`;
    console.log(finalMsg);

    const plainStatus = success ? "✓" : "✗";
    const plainPrefix = `[${timestamp}] <${this.ui.agentNickname}>`;
    this.ui.writeToLog(`${plainPrefix} * ${name} (${detail}) ${plainStatus}`);
  }
}
