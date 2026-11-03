import fs from "fs/promises";

/**
 * Handles session-related commands, including history rewriting 
 * and payload saving.
 */
class SessionCommands {
  /**
   * Rewrites the last complete turn through the session's transactional operation.
   * @param {object} chatManager The chat manager instance.
   * @param {object} ui The terminal UI instance.
   * @param {string} newMessage The new message to send after rewriting.
   * @returns {Promise<boolean>} True if the operation succeeded.
   */
  static async handleRewrite(chatManager, ui, newMessage) {
    if (await chatManager.rewriteLastTurn(newMessage)) {
      ui.displayInfo("Last turn rewritten.");
    }
    return true;
  }

  /**
   * Saves the last request payload to a JSON file for debugging purposes.
   * @param {object} chatManager The chat manager instance.
   * @param {object} ui The terminal UI instance.
   * @param {string} filename The filename to save the payload to.
   * @returns {Promise<boolean>} True if the operation succeeded.
   */
  static async handleSavePayload(chatManager, ui, filename) {
    const { lastPayload } = chatManager.assistant;
    if (!lastPayload) {
      ui.displayError("No request payload available to save.");
      return true;
    }
    try {
      await fs.writeFile(
        filename,
        JSON.stringify(lastPayload, null, 4),
        "utf8",
      );
      ui.displayInfo(`Last request payload saved to ${filename}`);
    } catch (e) {
      ui.displayError(`Error saving payload: ${e.message}`);
    }
    return true;
  }

  /**
   * Injects a predefined context-recovery prompt into the chat.
   * @param {object} chatManager The chat manager instance.
   * @param {object} ui The terminal UI instance.
   * @returns {Promise<boolean>} True if the operation succeeded.
   */
  static async handleInjectContext(chatManager, ui) {
    const contextPrompt = "Read the last messages from the log ./.paser-mini/log/session.log to get into context.";
    ui.displayChatMessage(chatManager.user.nickname, contextPrompt);
    await chatManager.processTurn(contextPrompt);
    return true;
  }
}

export default SessionCommands;
