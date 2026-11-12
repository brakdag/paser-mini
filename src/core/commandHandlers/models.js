import parseCommandArguments from "../../utils/commandArguments.js";

/**
 * Handles commands for managing AI models, including selection, availability checks, and variant switching.
 */
class ModelCommands {
  /**
   * Selects an exact model identifier without consulting provider model lists.
   * @param {object} chatManager - Session manager.
   * @param {object} ui - Terminal UI.
   * @param {string} payload - Model identifier, optionally quoted.
   * @returns {Promise<boolean>} Whether the command was handled.
   */
  static async handleModel(chatManager, ui, payload) {
    try {
      const args = parseCommandArguments(payload);
      if (args.length !== 1 || !args[0].trim()) throw new Error('Usage: /model "model-id"');
      const [modelName] = args;
      await chatManager.switchProvider({
        providerId: chatManager.assistant.providerId, modelName, temp: chatManager.model.temperature,
      });
      chatManager.saveConfig("model_name", modelName);
      ui.displayInfo(`Model changed to ${modelName}`);
    } catch (error) {
      ui.displayError(error.message);
    }
    return true;
  }

  /**
   * Lists available models or changes the current model and temperature.
   * @param {object} chatManager The chat manager instance.
   * @param {object} ui The terminal UI instance.
   * @param {string[]} parts The command arguments split into an array.
   * @returns {Promise<boolean>} True if the operation succeeded.
   */
  static async handleModels(chatManager, ui, parts) {
    try {
      const arg = parts[1]?.replace(/^["']|["']$/g, "");
      const isIndex = arg !== undefined && /^\d+$/.test(arg);
      let modelName = arg;

      if (arg === undefined || isIndex || chatManager.assistant.providerId !== "GEMINI") {
        const allModels = await chatManager.assistant.getAvailableModels();
        const unavailable = chatManager.configManager.get("unavailable_models", []);
        const models = allModels.filter((m) => !unavailable.includes(m));

        if (arg === undefined) {
          ui.displayMenu("Available Models", models);
          return true;
        }

        modelName = isIndex
          ? models[Number(arg)]
          : models.find((m) => m.toLowerCase() === arg.toLowerCase());
      }

      if (!modelName) {
        throw new Error("Invalid model identifier.");
      }

      const newTemp = parts[2] ? parseFloat(parts[2]) : chatManager.model.temperature;

      await chatManager.switchProvider({
        providerId: chatManager.assistant.providerId, modelName, temp: newTemp,
      });
      chatManager.saveConfig("model_name", modelName);
      chatManager.saveConfig("default_temperature", newTemp);

      ui.displayInfo(`Model changed to ${modelName} | Temperature: ${newTemp}`);
    } catch (error) {
      ui.displayError(error.message || "Invalid model index or temperature.");
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
