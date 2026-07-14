/**
 * Map of specific channels to their descriptive operational modes.
 */
const CHANNEL_MODES = {
  "#charla": "Casual, friendly, and conversational mode.",
  "#work": "Professional, focused, and highly efficient engineering mode.",
};

/**
 * Handles interface-related commands, including rendering modes, 
 * user identity, and channel management.
 */
class InterfaceCommands {
  /**
   * Internal helper to update rendering mode and notify the UI.
   * @param {object} chatManager The chat manager instance.
   * @param {object} ui The terminal UI instance.
   * @param {string} mode The rendering mode identifier.
   * @param {string} description The human-readable description of the mode.
   * @returns {boolean} True if the operation succeeded.
   * @private
   */
  static _setRenderingMode(chatManager, ui, mode, description) {
    chatManager.setRenderingMode(mode);
    ui.displayInfo(`Rendering mode set to ${description}`);
    return true;
  }

  /**
   * Sets the rendering mode to Fountain (Screenplay).
   * @param {object} chatManager The chat manager instance.
   * @param {object} ui The terminal UI instance.
   * @returns {boolean} True if the operation succeeded.
   */
  static handleFountain(chatManager, ui) {
    return InterfaceCommands._setRenderingMode(chatManager, ui, "FOUNTAIN", "Fountain (Screenplay)");
  }

  /**
   * Sets the rendering mode to IRC (Default).
   * @param {object} chatManager The chat manager instance.
   * @param {object} ui The terminal UI instance.
   * @returns {boolean} True if the operation succeeded.
   */
  static handleIRC(chatManager, ui) {
    return InterfaceCommands._setRenderingMode(chatManager, ui, "IRC", "IRC (Default)");
  }

  /**
   * Sets the rendering mode to Clean (Minimalist).
   * @param {object} chatManager The chat manager instance.
   * @param {object} ui The terminal UI instance.
   * @returns {boolean} True if the operation succeeded.
   */
  static handleClean(chatManager, ui) {
    return InterfaceCommands._setRenderingMode(chatManager, ui, "CLEAN", "Clean (Minimalist)");
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
    chatManager.updateUserNickname(newNick);
    ui.setUserNickname(newNick);
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
      const modeDesc = CHANNEL_MODES[channel] || "General purpose mode.";
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
    const helpData = [
      ["/help", "Show this help menu"],
      ["/config", "Show current system configuration"],
      ["/models", "Change AI model and temperature"],
      ["/cache", "Rebuild system prompt and tools cache"],
      ["/fav", "Manage favorite models (/fav, /fav+, /fav -<idx>, /fav <idx>)"],
      ["/reset", "Hard Reset: Clear history and Leap via Bridge Block"],
      ["/r <msg>", "Rewrite: Remove last interaction and re-prompt"],
      ["/rpm <n>", "Set RPM (Requests Per Minute) limit"],
      ["/clear", "Clear terminal"],
      ["/tool <call>", "Execute a tool directly, e.g. /tool read(\"file.js\")"],
      ["/ping <msg>", "Send a message and measure response latency"],
      ["/fountain", "Set rendering mode to Screenplay"],
      ["/irc", "Set rendering mode to IRC (default)"],
      ["/clean", "Set rendering mode to Clean (Minimalist)"],
      ["/topic <text>", "Change the channel topic"],
      ["/nick <name>", "Change your user nickname"],
      ["/me <action>", "Perform an action (roleplay)"],
      ["/action <txt>", "Perform a narrative action (full-width)"],
      ["/paim <msg>", "Simulate AI response (Pishin AI Message)"],
      ["/join <#ch>", "Change channel and mode (#charla, #work)"],
      ["/s [file]", "Save last request payload to JSON"],
      ["/q, /quit, /exit", "Exit application"],
    ];

    ui.displayInfoPanel("Available Commands", helpData);
    return true;
  }
}

export default InterfaceCommands;