import RendererStrategy from "./RendererStrategy.js";
import IRCFormatter from "../../utils/ircFormatter.js";
import chalk from "chalk";
import terminalRenderer from "../TerminalRenderer.js";

export default class IrcRenderer extends RendererStrategy {
  displayChatMessage(nickname, text) {
    const trimmedText = text.trim();
    const renderedText = terminalRenderer.formatMarkdown(trimmedText);

    if (
      trimmedText.startsWith("---") ||
      trimmedText.startsWith("***") ||
      trimmedText.startsWith("-!-")
    ) {
      const formatted = `[${IRCFormatter.getTimestamp()}] ${trimmedText}`;
      process.stdout.write(
        `${chalk.white(`[${IRCFormatter.getTimestamp()}]`)} ${renderedText}\n`
      );
      this.ui.writeToLog(formatted);
    } else {
      const formatted = IRCFormatter.formatMessage(nickname, trimmedText);
      const terminalMsg = IRCFormatter.formatTerminalMessage(
        nickname,
        renderedText,
        this.ui.agentNickname
      );
      process.stdout.write(`${terminalMsg}\n`);
      this.ui.writeToLog(formatted);
    }
  }

  displayToolStatus(name, success, detail) {
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
