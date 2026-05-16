/**
 * Base class for all rendering plugins.
 * Ensures a consistent interface for transforming message objects into formatted strings.
 */
class BaseRenderer {
  /**
   * Renders a message into a formatted string.
   * @param {Object} message - The message object { nickname, text, time, type }
   * @param {Object} ui - Reference to the TerminalUI for shared utilities (like formatMarkdown)
   * @returns {string} The formatted string to be printed to the terminal.
   */
  render(message, ui) {
    throw new Error("Method 'render()' must be implemented.");
  }
}

export default BaseRenderer;
