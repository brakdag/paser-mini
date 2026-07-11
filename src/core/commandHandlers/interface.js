/**
 * Handles interface-related commands, including rendering modes, 
 * user identity, and channel management.
 */
class InterfaceCommands {
  /**
   * Sets the rendering mode to Fountain (Screenplay).
   * @param {object} chatManager The chat manager instance.
   * @param {object} ui The terminal UI instance.
   * @returns {boolean} True if the operation succeeded.
   */
  static handleFountain(chatManager, ui) {
    chatManager.setRenderingMode("FOUNTAIN");
    ui.displayInfo("Rendering mode set to Fountain (Screenplay)");
    return true;
  }

  /**
   * Sets the rendering mode to IRC (Default).
   * @param {object} chatManager The chat manager instance.
   * @param {object} ui The terminal UI instance.
   * @returns {boolean} True if the operation succeeded.
   */
  static handleIRC(chatManager, ui) {
    chatManager.setRenderingMode("IRC");
    ui.displayInfo("Rendering mode set to IRC (Default)");
    return true;
  }

  /**
   * Sets the rendering mode to Clean (Minimalist).
   * @param {object} chatManager The chat manager instance.
   * @param {object} ui The terminal UI instance.
   * @returns {boolean} True if the operation succeeded.
   */
  static handleClean(chatManager, ui) {
    chatManager.setRenderingMode("CLEAN");
    ui.displayInfo("Rendering mode set to Clean (Minimalist)");
    return true;
  }

  /**
   * Toggles the Immersion Mode (raw formatting in payloads).
   * @param {object} chatManager The chat manager instance.
   * @param {object} ui The terminal UI instance.
   * @returns {boolean} True if the operation succeeded.
   */
  static handleTrue(chatManager, ui) {
    const newState = !chatManager.immersionMode;
    chatManager.setImmersionMode(newState);
    ui.displayInfo(
      `Immersion Mode (Raw Payloads) ${newState ? "enabled" : "disabled"}.`,
    );
    return true;
  }

  /**
   * Changes the current channel topic and notifies the system.
   * @param {object} chatManager The chat manager instance.
   * @param {object} ui The terminal UI instance.
   * @param {string} topic The new topic text.
   * @returns {Promise<boolean>} True if the operation succeeded.
   */
  static async handleTopic(chatManager, ui, topic) {
    ui.displaySystemMessage(`Topic changed to: ${topic}`);
    const actionMsg = `SCENE: ${topic}`;
    await chatManager.processTurn(`* ${actionMsg} *`);
    return true;
  }

  /**
   * Changes the user's nickname and updates the assistant's context.
   * @param {object} chatManager The chat manager instance.
   * @param {object} ui The terminal UI instance.
   * @param {string} newNick The new nickname to set.
   * @returns {Promise<boolean>} True if the operation succeeded.
   */
  static async handleNick(chatManager, ui, newNick) {
    chatManager.configManager.save("user_nickname", newNick);
     
    ui.setUserNickname(newNick);
    chatManager.assistant.updateNicknames(newNick, ui.agentNickname);
    ui.displayInfo(`User nickname successfully changed to '${newNick}'`);
    return true;
  }

  /**
   * Performs a roleplay action as the user.
   * @param {object} chatManager The chat manager instance.
   * @param {object} ui The terminal UI instance.
   * @param {string} action The action text to perform.
   * @returns {Promise<boolean>} True if the operation succeeded.
   */
  static async handleMe(chatManager, ui, action) {
    const formattedAction = `* ${action} *`;
    ui.displayChatMessage(ui.userNickname, formattedAction);
    await chatManager.processTurn(formattedAction);
    return true;
  }

  /**
   * Performs a narrative action, handling Fountain and IRC modes differently.
   * @param {object} chatManager The chat manager instance.
   * @param {object} ui The terminal UI instance.
   * @param {string} actionText The action text to perform.
   * @returns {Promise<boolean>} True if the operation succeeded.
   */
  static async handleAction(chatManager, ui, actionText) {
    const actionContent = `* ACTION: ${actionText} *`;
    ui.displayChatMessage("system", actionContent);
    chatManager.assistant.injectMessage("server", actionContent);
    return true;
  }

  /**
   * Injects a scene and action into the assistant's context in Fountain format.
   * @param {object} chatManager The chat manager instance.
   * @param {object} ui The terminal UI instance.
   * @param {string} scene The scene name.
   * @param {string} action The action description.
   * @returns {Promise<string>} A confirmation string "OK".
   */
  static async handleInsertSceneFountain(chatManager, ui, scene, action) {
    const formattedScene = scene.toUpperCase();
    const formattedAction = action.startsWith("/") ? action : `/${action}`;
    const output = `\n${formattedScene}\n${formattedAction}\n`;
    ui.displaySystemMessage(`Injecting: ${output}`);
    chatManager.assistant.injectMessage("user", output);
    return "OK";
  }

  /**
   * Changes the current channel and adjusts the system mode accordingly.
   * @param {object} chatManager The chat manager instance.
   * @param {object} ui The terminal UI instance.
   * @param {string} channel The channel name (must start with #).
   * @returns {Promise<boolean>} True if the operation succeeded.
   */
  static async handleJoin(chatManager, ui, channel) {
    if (ui.renderingMode !== "FOUNTAIN" && !channel.startsWith("#")) {
      ui.displayError("Channel name must start with # (e.g., /join #work)");
      return true;
    }
     
    chatManager.setCurrentChannel(channel);
    if (ui.renderingMode === "FOUNTAIN") {
      ui.displaySystemMessage(`Scene changed to: ${channel}`);
      await chatManager.processTurn(`* SCENE: ${channel} *`);
    } else {
      let modeDesc = "General purpose mode.";
      if (channel === "#charla") {
        modeDesc = "Casual, friendly, and conversational mode.";
      } else if (channel === "#work") {
        modeDesc = 
          "Professional, focused, and highly efficient engineering mode.";
      }
      const systemMsg = `Joined channel ${channel}. Mode: ${modeDesc}`;
      ui.displaySystemMessage(systemMsg);
      chatManager.assistant.injectMessage("server", systemMsg);
    }
    return true;
  }

  /**
   * Displays the help menu listing all available commands.
   * @param {object} ui The terminal UI instance.
   * @returns {boolean} True if the operation succeeded.
   */
  static handleHelp(ui) {
    const helpText = 
      "\nAvailable Commands:\n-------------------\n" +
      "/help       - Show this help menu\n" +
      "/config     - Show current system configuration\n" +
      "/models     - Change AI model and temperature\n" +
      "/fav        - Manage favorite models (/fav, /fav+, /fav -<idx>, /fav <idx>)\n" +
      "/reset      - Hard Reset: Clear history and Leap via Bridge Block\n" +
      "/r <msg>    - Rewrite: Remove last interaction and re-prompt\n" +
      "/rpm <n>    - Set RPM (Requests Per Minute) limit\n" +
      "AQUI      - Clear terminal\n" +
      "/tool <call> - Execute a tool directly, e.g. /tool read(\"file.js\")\n" +
      "/ping <msg> - Send a message and measure response latency\n" +
      "/fountain   - Set rendering mode to Screenplay\n" +
      "/irc        - Set rendering mode to IRC (default)\n" +
      "/clean      - Set rendering mode to Clean (Minimalist)\n" +
      "/topic <text> - Change the channel topic\n" +
      "/nick <name> - Change your user nickname\n" +
      "/me <action> - Perform an action (roleplay)\n" +
      "/action <txt> - Perform a narrative action (full-width)\n" +
      "/paim <msg>  - Simulate AI response (Pishin AI Message)\n" +
      "/join <#ch> - Change channel and mode (#charla, #work)\n" +
      "/s [file]   - Save last request payload to JSON\n" +
      "/q, /quit, /exit - Exit application\n";
    ui.displayMessage(helpText);
    return true;
  }
}

export default InterfaceCommands;