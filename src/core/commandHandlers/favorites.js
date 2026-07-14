/**
 * Handles commands for managing and loading favorite AI models.
 */
class FavoriteCommands {
  /**
   * Handles the /fav command, allowing users to list, add, remove, or load favorite models.
   * @param {object} chatManager The chat manager instance.
   * @param {object} ui The terminal UI instance.
   * @param {string[]} parts The command arguments split into an array.
   * @returns {Promise<boolean>} True if the operation succeeded.
   */
  static async handleFav(chatManager, ui, parts) {
    const favorites = chatManager.configManager.get("favorites", []);

    if (parts.length === 1) {
      if (favorites.length === 0) {
        ui.displayInfo(
          "No favorite models saved. Use /fav+ to add the current one.",
        );
        return true;
      }

      const favNames = favorites.map((f) => `${f.model} (${f.provider}) [Temp: ${f.temp}]`);
      ui.displayMenu("Favorite Models", favNames);
      return true;
    }

    if (parts[1] === "+") {
      const provider = chatManager.configManager.get("provider", "Gemini");
      const model = chatManager.assistant.currentModel;
      const temp = chatManager.temperature;
      const newFav = { provider, model, temp };

      if (
        !favorites.some((f) => f.model === model && f.provider === provider)
      ) {
        favorites.push(newFav);
        chatManager.configManager.save("favorites", favorites);
        ui.displayInfo(`Added to favorites: ${provider} | ${model}`);
      } else {
        ui.displayInfo("Model already in favorites.");
      }
      return true;
    }

    if (parts[1].startsWith("-")) {
      try {
        const idx = parseInt(parts[1].slice(1), 10);
        if (idx >= 0 && idx < favorites.length) {
          const removed = favorites.splice(idx, 1)[0];
          chatManager.configManager.save("favorites", favorites);
          ui.displayInfo(`Removed from favorites: ${removed.model}`);
        } else {
          ui.displayError("Invalid index.");
        }
      } catch {
        ui.displayError("Usage: /fav -<index>");
      }
      return true;
    }

    try {
      const idx = parseInt(parts[1], 10);
      if (idx >= 0 && idx < favorites.length) {
        const fav = favorites[idx];
        const providerName = fav.provider;
        const currentProvider = chatManager.configManager.get(
          "provider",
          "Gemini",
        );

        if (providerName !== currentProvider) {
          await chatManager.switchProvider(providerName, fav.model, fav.temp);
          chatManager.configManager.save("provider", providerName);
        }

        chatManager.configManager.save("model_name", fav.model);
        chatManager.configManager.save("default_temperature", fav.temp);
        chatManager.setTemperature(fav.temp);
        chatManager.assistant.startChat(
          fav.model,
          chatManager.systemInstruction,
          fav.temp,
        );

        ui.displayInfo(
          `Loaded favorite ${idx}: ${providerName} | ${fav.model} | Temp: ${fav.temp}`,
        );
      } else {
        ui.displayError("Favorite index not found.");
      }
    } catch {
      ui.displayError("Usage: /fav <index> or /fav+ or /fav -<index>");
    }
    return true;
  }
}


export default FavoriteCommands;