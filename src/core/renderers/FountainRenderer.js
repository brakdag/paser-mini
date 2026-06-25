import RendererStrategy from "./RendererStrategy.js";
import terminalRenderer from "../TerminalRenderer.js";
import IRCFormatter from "../../utils/ircFormatter.js";
import chalk from "chalk";

export default class FountainRenderer extends RendererStrategy {
  displayChatMessage(nickname, text) {
    const trimmedText = text.trim();
    const fountainText = terminalRenderer.renderFountain(nickname, trimmedText);
    const renderedText = terminalRenderer.formatMarkdown(fountainText);
    process.stdout.write(`${renderedText}\n`);
    this.ui.writeToLog(renderedText);
  }

  displayToolStatus(name, success, detail) {
    const chalkStatus = success ? chalk.green("✓") : chalk.red("✗");
    const timestamp = IRCFormatter.getTimestamp();
    const prefix = `[${timestamp}] <${chalk.cyan(this.ui.agentNickname)}>`;
    console.log(`${prefix} * ${name} (${detail}) ${chalkStatus}`);

    const plainStatus = success ? "✓" : "✗";
    const cleanToolLog = `${name} (${detail}) ${plainStatus}`;
    const logStr = terminalRenderer.renderFountain("system", `* ACTION: ${cleanToolLog}`);
    this.ui.writeToLog(logStr);
  }

  processInput(userInput) {
    const nick =
      userInput.startsWith("* SCENE:") || userInput.startsWith("* ACTION:")
        ? "system"
        : this.ui.userNickname;
    return terminalRenderer.renderFountain(nick, userInput);
  }

  async processResponse(assistant, response) {
    const formatted = terminalRenderer.renderFountain(this.ui.agentNickname, response);
    await assistant.popLastMessage();
    await assistant.injectMessage("model", formatted);
    return formatted;
  }

  formatToolResults(results) {
    return terminalRenderer.renderFountain("system", results.join("\n"));
  }

  formatAction(text) {
    return `* ACTION: ${text} *`;
  }

  formatHistoryMessage(role, text) {
    return text;
  }

  requiresChannelHash() {
    return false;
  }
}
