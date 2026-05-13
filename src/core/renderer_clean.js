import { BaseRenderer } from "./renderer_base.js";

export class CleanRenderer extends BaseRenderer {
  render(message) {
    const { text } = message;
    const trimmedText = text.trim();
    const formattedText = this.ui.formatMarkdown(trimmedText);
    
    return formattedText + "\n";
  }
}