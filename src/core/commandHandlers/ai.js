/**
 * Handles AI-related commands such as connecting to providers and injecting messages.
 */
class AICommands {
  /**
   * Injects a message into the chat history and displays it in the UI.
   * @param {object} chatManager The chat manager instance.
   * @param {object} ui The terminal UI instance.
   * @param {string} message The message to inject.
   * @returns {Promise<boolean>} True if the operation succeeded.
   */
  static async handlePaim(chatManager, ui, message) {
    const content = ui.formatChatMessage(ui.agentNickname, message);
    chatManager.assistant.injectMessage("model", content);
    ui.displayChatMessage(ui.agentNickname, message);
    return true;
  }

  /**
   * Handles the provider connection process, allowing the user to select a provider from a menu.
   * @param {object} chatManager The chat manager instance.
   * @param {object} ui The terminal UI instance.
   * @returns {Promise<boolean>} True if the operation succeeded.
   */
  /**
   * Resolves a provider argument (name, id, or index) to a provider entry.
   * @param {Array<object>} providers - The list of available providers.
   * @param {string} arg - The user-provided argument.
   * @returns {object|null} The matched provider or null.
   * @private
   */
  static _resolveProvider(providers, arg) {
    if (!arg) return null;

    const normalized = arg.toLowerCase().replace(/[^a-z0-9]/gi, "");

    const byId = providers.find((p) => p.id.toLowerCase() === normalized);
    if (byId) return byId;

    const byName = providers.find((p) => {
      const pNorm = p.name.toLowerCase().replace(/[^a-z0-9]/gi, "");
      return pNorm === normalized || pNorm.includes(normalized) || normalized.includes(pNorm);
    });
    if (byName) return byName;

    const index = parseInt(arg, 10);
    if (!Number.isNaN(index) && index >= 0 && index < providers.length) {
      return providers[index];
    }

    return null;
  }

  /**
   * Handles the provider connection process.
   * Accepts a direct provider name (e.g. 'cerebras.ai') or shows an interactive menu.
   * @param {object} chatManager The chat manager instance.
   * @param {object} ui The terminal UI instance.
   * @param {string} [providerArg] - Optional provider name, id, or index.
   * @returns {Promise<boolean>} True if the operation succeeded.
   */
  static async handleConnect(chatManager, ui, providerArg = "") {
    const providers = chatManager.providerManager.getProviders();
    const trimmedArg = providerArg.trim();
    let selectedProvider;

    if (trimmedArg) {
      selectedProvider = AICommands._resolveProvider(providers, trimmedArg);
      if (!selectedProvider) {
        ui.displayError(`Unknown provider: ${trimmedArg}`);
        return true;
      }
    } else {
      const providerNames = providers.map((p) => p.name);
      ui.displayMenu("Select Provider", providerNames);
      const choice = await ui.requestInput("Provider: ");
      const selectedIndex = parseInt(choice, 10);

      if (Number.isNaN(selectedIndex) || selectedIndex < 0 || selectedIndex >= providers.length) {
        ui.displayError("Invalid provider.");
        return true;
      }
      selectedProvider = providers[selectedIndex];
    }

    const { id, defaultModel } = selectedProvider;

    await chatManager.switchProvider(id, defaultModel, chatManager.model.temperature);
    chatManager.configManager.save("provider", id);
    chatManager.configManager.save("model_name", defaultModel);
    ui.displayInfo(`Connected to ${id}`);
    return true;
  }
}


export default AICommands;