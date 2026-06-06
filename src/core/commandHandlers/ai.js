class AICommands {
  static async handlePaim(chatManager, ui, message) {
    const content =
      ui.renderingMode === "FOUNTAIN"
        ? ui._renderFountain(ui.agentNickname, message)
        : message;
    chatManager.assistant.injectMessage("model", content);
    ui.displayChatMessage(ui.agentNickname, message);
    return true;
  }

  static async handleConnect(chatManager, ui) {
    const providers = chatManager.providerManager.getProviders();
    let menu = "Select Provider:\n";
    providers.forEach((p, i) => {
      menu += `${i}: ${p.name}\n`;
    });

    ui.displayMessage(menu);
    const choice = await ui.requestInput("Provider: ");
    const selectedIndex = parseInt(choice, 10);

    if (Number.isNaN(selectedIndex) || selectedIndex < 0 || selectedIndex >= providers.length) {
      ui.displayError("Invalid provider.");
      return true;
    }

    const { id, defaultModel } = providers[selectedIndex];

    await chatManager.switchProvider(id, defaultModel, chatManager.temperature);
    chatManager.configManager.save("provider", id);
    chatManager.configManager.save("model_name", defaultModel);
    ui.displayInfo(`Connected to ${id}`);
    return true;
  }
}


export default AICommands;