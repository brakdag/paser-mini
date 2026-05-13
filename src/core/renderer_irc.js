import chalk from "chalk";
import { BaseRenderer } from "./renderer_base.js";

export class IRCRenderer extends BaseRenderer {
  render(message) {
    const { nickname, text, time, type } = message;
    const trimmedText = text.trim();
    const formattedText = this.ui.formatMarkdown(trimmedText);
    const timestamp = time || new Date().toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    });

    // Handle System Messages
    if (type === 'system' || trimmedText.startsWith("---") || trimmedText.startsWith("***") || trimmedText.startsWith("-!-")) {
      const formattedSystem = this.ui.formatMarkdown(trimmedText);
      return `[${timestamp}] ${formattedSystem}\n`;
    }

    // Handle standard chat
    const nameColor = nickname === this.ui.agentNickname ? chalk.cyan : chalk.green;
    const prefix = `[${timestamp}] <${nameColor(nickname)}>`;
    
    return `${prefix} ${formattedText}\n`;
  }
}