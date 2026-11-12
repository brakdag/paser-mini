import parseCommandArguments from "../../utils/commandArguments.js";

/**
 * Handles AI-related commands such as connecting to providers and injecting messages.
 */
class AICommands {
  /**
   * Configures and activates a custom chat-completions endpoint.
   * @param {object} chatManager - Session manager.
   * @param {object} ui - Terminal UI.
   * @param {string} payload - Endpoint URL; authentication comes from CUSTOM_API_KEY.
   * @returns {Promise<boolean>} Whether the command was handled.
   */
  static async handleCustom(chatManager, ui, payload) {
    try {
      const args = parseCommandArguments(payload);
      if (args.length !== 1) throw new Error('Usage: /custom "endpoint" (set CUSTOM_API_KEY in the environment for authentication)');
      const configOverrides = {
        compatible_base_url: args[0], compatible_api_key_env: null,
      };
      const modelName = chatManager.model.name;
      await chatManager.switchProvider({
        providerId: "COMPATIBLE", modelName, temp: chatManager.model.temperature, configOverrides,
      });
      Object.entries(configOverrides).forEach(([key, value]) => chatManager.saveConfig(key, value));
      if (chatManager.configManager.get("compatible_api_key") != null) chatManager.saveConfig("compatible_api_key", null);
      chatManager.saveConfig("provider", "COMPATIBLE");
      chatManager.saveConfig("model_name", modelName);
      ui.displayInfo(`Compatible endpoint configured. Current model: ${modelName}. Use /model "model-id" to change it.`);
    } catch (error) {
      ui.displayError(error.message);
    }
    return true;
  }

  /**
   * Injects a message into the chat history and displays it in the UI.
   * @param {object} chatManager The chat manager instance.
   * @param {object} ui The terminal UI instance.
   * @param {string} message The message to inject.
   * @returns {Promise<boolean>} True if the operation succeeded.
   */
  static async handlePaim(chatManager, ui, message) {
    chatManager.assistant.injectMessage("model", message);
    ui.displayChatMessage(chatManager.model.nickname, message);
    return true;
  }

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

    const { id } = selectedProvider;
    const defaultModel = selectedProvider.defaultModel || String(chatManager.configManager.get("model_name", ""));

    await chatManager.switchProvider({ providerId: id, modelName: defaultModel, temp: chatManager.model.temperature });
    chatManager.saveConfig("provider", id);
    chatManager.saveConfig("model_name", defaultModel);
    ui.displayInfo(`Connected to ${id}`);
    return true;
  }
}


export default AICommands;
