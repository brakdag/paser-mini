/**
 * Handles system-level commands such as clearing the terminal, 
 * exiting the application, and resetting the session.
 */
class SystemCommands {
  /**
   * Clears the terminal screen.
   * @returns {boolean} True if the operation succeeded.
   */
  static handleClear() {
    process.stdout.write("\x1Bc");
    return true;
  }

  /**
   * Requests the application to exit and terminates the process.
   * @param {object} chatManager The chat manager instance.
   * @returns {void}
   */
  static handleExit(chatManager) {
    chatManager.requestExit();
    process.exit(0);
  }

  /**
   * Performs a hard reset of the assistant's state.
   * @param {object} chatManager The chat manager instance.
   * @param {object} ui The terminal UI instance.
   * @returns {Promise<boolean>} True if the operation succeeded.
   */
  static async handleReset(chatManager, ui) {
    ui.displayInfo("Performing Hard Reset...");
    ui.displayInfo("Starting fresh.");
    chatManager.assistant.hardReset();
    return true;
  }

  /**
   * Enables bash access and notifies the assistant of the new capability.
   * @param {object} chatManager The chat manager instance.
   * @param {object} ui The terminal UI instance.
   * @returns {boolean} True if the operation succeeded.
   */
  static handleEnableBash(chatManager, ui) {
    ui.setBashEnabled(true);
    ui.displayInfo("Bash access enabled. You can now use executeBash.");
    const bashInstruction = 
      "SYSTEM UPDATE: Bash access has been enabled. You now have access to the tool `executeBash(command: string)`, which allows you to execute shell commands in the project root.";
    const content = ui.formatSystemMessage(bashInstruction);
    chatManager.assistant.injectMessage("server", content);
    return true;
  }

  /**
   * Displays the current system prompt to the user.
   * @param {object} chatManager The chat manager instance.
   * @param {object} ui The terminal UI instance.
   * @returns {Promise<boolean>} True if the operation succeeded.
   */
  static async handleShowSystemPrompt(chatManager, ui) {
    const { systemInstruction } = chatManager;
    ui.displayInfo("--- CURRENT SYSTEM PROMPT ---");
    ui.displayMessage(systemInstruction);
    ui.displayInfo("----------------------------");
    return true;
  }
}

export default SystemCommands;