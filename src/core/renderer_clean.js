import { BaseRenderer } from "./renderer_base.js";

export class CleanRenderer extends BaseRenderer {
  render(message) {
    const { text } = message;
    const trimmedText = text.trim();
    
    // Filter out tool calls and tool responses from visual output
    if (trimmedText.includes("<TOOL_CALL>") || trimmedText.includes("<TOOL_RESPONSE>")) {
      return "";
    }

    const formattedText = this.ui.formatMarkdown(trimmedText);
    
    return formattedText + "\n";
  }
}