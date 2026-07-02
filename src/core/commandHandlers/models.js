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
    const models = await chatManager.assistant.getAvailableModels();
    const unavailable = chatManager.configManager.get("unavailable_models", []);

    if (parts.length === 1) {
      const header = "| ID | Model | ID | Model |\n|---|---|---|---|\n";
      const rows = [];
      for (let i = 0; i < models.length; i += 2) {
        let m1 = models[i];
        if (unavailable.includes(m1)) {
          m1 = `~~${m1}~~`;
        }
        let m2 = "";
        let idx2 = "";
        if (i + 1 < models.length) {
          m2 = models[i + 1];
          if (unavailable.includes(m2)) {
            m2 = `~~${m2}~~`;
          }
          idx2 = (i + 1).toString();
        }
        rows.push(`| ${i} | ${m1} | ${idx2} | ${m2} |`);
      }
      ui.displayMessage(
        `Available models (~~ = unavailable):\n\n${header}${rows.join("\n")}`,
      );
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

  /**
   * Lists available model variants or switches to a specific variant.
   * @param {object} chatManager The chatManager instance.
   * @param {object} ui The terminal UI instance.
   * @param {string[]} parts The command arguments split into an array.
   * @returns {Promise<boolean>} True if the operation succeeded.
   */
  static async handleVariants(chatManager, ui, parts) {
    const variants = chatManager.assistant.getVariants();
    if (variants.length === 0) {
      ui.displayInfo("No variants available for the current provider.");
      return true;
    }

    if (parts.length === 1) {
      ui.displayMessage(
        `Available variants:\n${variants.map((v, i) => `${i}: ${v.name} (${v.model})`).join("\n")}\n\nUse /variants <index> to select.`,
      );
      return true;
    }

    const idx = parseInt(parts[1], 10);
    if (idx < 0 || idx >= variants.length) {
      ui.displayError("Invalid variant index.");
      return true;
    }

    const variant = variants[idx];
    chatManager.configManager.save("model_name", variant.model);
    chatManager.configManager.save("default_temperature", variant.temp);
    chatManager.setTemperature(variant.temp);

    chatManager.assistant.startChat(
      variant.model,
      chatManager.systemInstruction,
      variant.temp,
    );

    ui.displayInfo(
      `Variant changed to ${variant.name} (${variant.model}) | Temperature: ${variant.temp}`,
    );
    return true;
  }
}

export default ModelCommands;