class InterfaceCommands {
  static handleFountain(chatManager, ui) {
    chatManager.setRenderingMode("FOUNTAIN");
    ui.displayInfo("Rendering mode set to Fountain (Screenplay)");
    return true;
  }

  static handleIRC(chatManager, ui) {
    chatManager.setRenderingMode("IRC");
    ui.displayInfo("Rendering mode set to IRC (Default)");
    return true;
  }

  static handleClean(chatManager, ui) {
    chatManager.setRenderingMode("CLEAN");
    ui.displayInfo("Rendering mode set to Clean (Minimalist)");
    return true;
  }

  static async handleTopic(chatManager, ui, topic) {
    ui.displaySystemMessage(`Topic changed to: ${topic}`);
    const actionMsg = `SCENE: ${topic}`;
    await chatManager.processTurn(`* ${actionMsg} *`);
    return true;
  }

  static async handleNick(chatManager, ui, newNick) {
    const oldNick = ui.userNickname;
    chatManager.configManager.save("user_nickname", newNick);
    // eslint-disable-next-line no-param-reassign
    ui.userNickname = newNick;
    chatManager.assistant.updateNicknames(newNick, ui.agentNickname);
    ui.displaySystemMessage(`${oldNick} changes his alias to ${newNick}`);
    const actionMsg = `changes his alias to ${newNick}`;
    await chatManager.processTurn(`*** ${actionMsg}`);
    return true;
  }

  static async handleMe(chatManager, ui, action) {
    const formattedAction = `* ${action} *`;
    ui.displayChatMessage(ui.userNickname, formattedAction);
    await chatManager.processTurn(formattedAction);
    return true;
  }

  static async handleAction(chatManager, ui, actionText) {
    if (ui.renderingMode === "FOUNTAIN") {
      ui.displaySystemMessage(actionText);
      const formatted = ui._renderFountain(
        "system",
        `* ACTION: ${actionText} *`,
      );
      chatManager.assistant.injectMessage("server", formatted);
    } else {
      const formattedAction = `*** [Action]: ${actionText}`;
      ui.displaySystemMessage(formattedAction);
      chatManager.assistant.injectMessage("server", formattedAction);
    }
    return true;
  }

  static async handleInsertSceneFountain(chatManager, ui, scene, action) {
    const formattedScene = scene.toUpperCase();
    const formattedAction = action.startsWith("/") ? action : `/${action}`;
    const output = `\n${formattedScene}\n${formattedAction}\n`;
    ui.displaySystemMessage(`Injecting: ${output}`);
    chatManager.assistant.injectMessage("user", output);
    return "OK";
  }

  static async handleJoin(chatManager, ui, channel) {
    if (ui.renderingMode !== "FOUNTAIN" && !channel.startsWith("#")) {
      ui.displayError("Channel name must start with # (e.g., /join #work)");
      return true;
    }
    // eslint-disable-next-line no-param-reassign
    chatManager.currentChannel = channel;
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
      const content =
        ui.renderingMode === "FOUNTAIN"
          ? ui._renderFountain("system", systemMsg)
          : systemMsg;
      chatManager.assistant.injectMessage("server", content);
    }
    return true;
  }

  static handleHelp(ui) {
    const helpText =
      "\nAvailable Commands:\n-------------------\n" +
      "/help       - Show this help menu\n" +
      "/config     - Show current system configuration\n" +
      "/models     - Change AI model and temperature\n" +
      "/fav        - Manage favorite models (/fav, /fav+, /fav -<idx>, /fav <idx>)\n" +
      "/reset      - Hard Reset: Clear history and Leap via Bridge Block\n" +
      "/r <msg>    - Rewrite: Remove last interaction and re-prompt\n" +
      "/w <t> <r> <p> - Set window, RPM, and TPM\n" +
      "/clear      - Clear terminal\n" +
      "/fountain   - Set rendering mode to Screenplay\n" +
      "/irc        - Set rendering mode to IRC (default)\n" +
      "/clean      - Set rendering mode to Clean (Minimalist)\n" +
      "/topic <text> - Change the channel topic\n" +
      "/nick <name> - Change the agent's nickname\n" +
      "/me <action> - Perform an action (roleplay)\n" +
      "/compact    - Compact history into IRC log and reset context\n" +
      "/action <txt> - Perform a narrative action (full-width)\n" +
      "/kick       - Kick agent: Nuclear reset, wipes all session memory\n" +
      "/paim <msg>  - Simulate AI response (Pishin AI Message)\n" +
      "/join <#ch> - Change channel and mode (#charla, #work)\n" +
      "/s [file]   - Save last request payload to JSON\n" +
      "/q, /quit, /exit - Exit application\n";
    ui.displayMessage(helpText);
    return true;
  }
}


export default InterfaceCommands;
