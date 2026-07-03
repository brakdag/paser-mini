import fs from "fs/promises";

/**
 * Handles session-related commands, including history rewriting 
 * and payload saving.
 */
class SessionCommands {
  /**
   * Removes the last interaction from history and reprompts the model with a new message.
   * @param {object} chatManager The chat manager instance.
   * @param {object} ui The terminal UI instance.
   * @param {string} newMessage The new message to send after rewriting.
   * @returns {Promise<boolean>} True if the operation succeeded.
   */
  static async handleRewrite(chatManager, ui, newMessage) {
    const history = chatManager.assistant.getHistory();
    if (history.length >= 2) {
      history.pop();
      history.pop();
      ui.displayInfo("Last interaction removed. Reprompting...");
      chatManager.toolTracker.reset();
      await chatManager.processTurn(newMessage);
    } else {
      ui.displayError("No interaction to remove.");
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
}


export default SessionCommands;