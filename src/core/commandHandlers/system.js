
class SystemCommands {
  static handleClear() {
    process.stdout.write("\x1Bc");
    return true;
  }

  static handleExit(chatManager) {
    chatManager.requestExit();
    process.exit(0);
  }

  static async handleReset(chatManager, ui) {
    ui.displayInfo("Performing Hard Reset...");
    ui.displayInfo("Starting fresh.");
    chatManager.assistant.hardReset();
    return true;
  }

  static async handleKick(chatManager, ui) {
    ui.displaySystemMessage("*** Agent kicked. Session wiped. Restarting...");
    chatManager.assistant.hardReset();
    ui.clearLog();
    ui.displayLogOpened();
    return true;
  }

  static handleEnableBash(chatManager, ui) {
    ui.setBashEnabled(true);
    ui.displayInfo("Bash access enabled. You can now use executeBash.");
    const bashInstruction =
      "SYSTEM UPDATE: Bash access has been enabled. You now have access to the tool `executeBash(command: string)`, which allows you to execute shell commands in the project root.";
    const content =
      ui.renderingMode === "FOUNTAIN"
        ? ui._renderFountain("system", bashInstruction)
        : bashInstruction;
    chatManager.assistant.injectMessage("server", content);
    return true;
  }

  static async handleShowSystemPrompt(chatManager, ui) {
    const { systemInstruction } = chatManager;
    ui.displayInfo("--- CURRENT SYSTEM PROMPT ---");
    ui.displayMessage(systemInstruction);
    ui.displayInfo("----------------------------");
    return true;
  }
}

export default SystemCommands;
