import fs from "fs/promises";

class SessionCommands {
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

  static async handleCompact(chatManager, ui) {
    ui.displayInfo("Compacting history into IRC log...");
    return chatManager.compactHistory();
  }

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
