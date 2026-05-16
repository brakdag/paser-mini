import BaseRenderer from "./renderer_base.js";

class CleanRenderer extends BaseRenderer {
  render(message, ui) {
    const { text } = message;
    const trimmedText = text.trim();

    // Filter out technical noise
    if (
      trimmedText.includes("<TOOL_CALL>") ||
      trimmedText.includes("<TOOL_RESPONSE>")
    ) {
      return "";
    }

    return ui.formatMarkdown(trimmedText) + "\n";
  }
}

export default CleanRenderer;
