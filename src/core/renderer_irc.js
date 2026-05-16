import BaseRenderer from "./renderer_base.js";
import chalk from "chalk";

class IRCRenderer extends BaseRenderer {
  render(message, ui) {
    const { nickname, text, time, type } = message;
    const trimmedText = text.trim();

    if (
      trimmedText.includes("<TOOL_CALL>") ||
      trimmedText.includes("<TOOL_RESPONSE>")
    ) {
      return "";
    }

    const formattedText = ui.formatMarkdown(trimmedText);
    const timestamp = time || new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

    // Handle System Messages
    if (
      type === "system" ||
      trimmedText.startsWith("---") ||
      trimmedText.startsWith("***") ||
      trimmedText.startsWith("-!-")
    ) {
      return `[${timestamp}] ${formattedText}\n`;
    }

    // Handle standard chat
    const nameColor = nickname === ui.agentNickname ? chalk.cyan : chalk.green;
    const prefix = `[${timestamp}] <${nameColor(nickname)}>`;

    return `${prefix} ${formattedText}\n`;
  }
}

export default IRCRenderer;
