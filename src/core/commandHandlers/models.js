/**
 * Handles commands for managing AI models, including selection, availability checks, and variant switching.
 */
class ModelCommands {
  /**
   * Lists available models or changes the current model and temperature.
   * @param {object} chatManager The chat manager instance.
   * @param {object} ui The terminal UI instance.
   * @param {string[]} parts The command arguments split into an array.
   * @returns {Promise<boolean>} True if the operation succeeded.
   */
  static async handleModels(chatManager, ui, parts) {
    const allModels = await chatManager.assistant.getAvailableModels();
    const unavailable = chatManager.configManager.get("unavailable_models", []);
    const models = allModels.filter((m) => !unavailable.includes(m));

    if (parts.length === 1) {
      ui.displayMenu("Available Models", models);
      return true;
    }

    try {
      const idx = parseInt(parts[1], 10);
      const modelName = models[idx];
      const newTemp = parts[2] ? parseFloat(parts[2]) : chatManager.temperature;

      chatManager.configManager.save("model_name", modelName);
      chatManager.configManager.save("default_temperature", newTemp);
      chatManager.setTemperature(newTemp);
      chatManager.assistant.startChat(
        modelName,
        chatManager.systemInstruction,
        newTemp,
      );

      ui.displayInfo(`Model changed to ${modelName} | Temperature: ${newTemp}`);
    } catch {
      ui.displayError("Invalid model index or temperature.");
    }
    return true;
  }

  /**
   * Scans all available models to check their current availability and updates the unavailable list.
   * @param {object} chatManager The chat manager instance.
   * @param {object} ui The terminal UI instance.
   * @returns {Promise<boolean>} True if the operation succeeded.
   */
  static async handleModelsCheck(chatManager, ui) {
    const models = await chatManager.assistant.getAvailableModels();
    if (models.length === 0) {
      ui.displayError("No models found to check.");
      return true;
    }

    const unavailable = [];
    ui.displayInfo("Model Scan: Initializing...");

    for (let i = 0; i < models.length; i += 1) {
      const model = models[i];
      ui.displayInfo(`Model Scan: Checking ${i + 1}/${models.length} -> ${model}`);
      const isAvailable = await chatManager.assistant.checkAvailability(model);
      if (!isAvailable) {
        unavailable.push(model);
      }
    }

    chatManager.configManager.save("unavailable_models", unavailable);
    ui.displayInfo(`Model Scan complete. ${unavailable.length} models unavailable.`);
    ui.displayInfo(
      `Diagnostic finished. Updated unavailable_models list (${unavailable.length} entries).`,
    );

    return true;
  }

}

export default ModelCommands;