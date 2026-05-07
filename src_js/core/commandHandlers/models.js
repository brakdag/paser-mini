export class ModelCommands {
  static async handleModels(chatManager, ui, parts) {
    const models = await chatManager.assistant.getAvailableModels();
    const unavailable = chatManager.configManager.get('unavailable_models', []);

    if (parts.length === 1) {
      let header = '| ID | Model | ID | Model |\n|---|---|---|---|\n';
      let rows = [];
      for (let i = 0; i < models.length; i += 2) {
        let m1 = models[i];
        if (unavailable.includes(m1)) m1 = `~~${m1}~~`;
        let m2 = '';
        let idx2 = '';
        if (i + 1 < models.length) {
          m2 = models[i + 1];
          if (unavailable.includes(m2)) m2 = `~~${m2}~~`;
          idx2 = (i + 1).toString();
        }
        rows.push(`| ${i} | ${m1} | ${idx2} | ${m2} |`);
      }
      ui.displayMessage(`Available models (~~ = unavailable):\n\n${header}${rows.join('\n')}`);
      return true;
    }

    try {
      const idx = parseInt(parts[1], 10);
      const modelName = models[idx];
      const newTemp = parts[2] ? parseFloat(parts[2]) : chatManager.temperature;
      
      chatManager.configManager.save('model_name', modelName);
      chatManager.configManager.save('default_temperature', newTemp);
      chatManager.temperature = newTemp;
      chatManager.assistant.startChat(modelName, chatManager.systemInstruction, newTemp);
      
      ui.displayInfo(`Modelo cambiado a ${modelName} | Temperatura: ${newTemp}`);
    } catch (e) {
      ui.displayError('Invalid model index or temperature.');
    }
    return true;
  }

  static async handleModelsCheck(chatManager, ui, parts) {
    if (typeof chatManager.assistant.checkAvailability !== 'function') {
      ui.displayError('Model check is only available for NVIDIA provider.');
      return true;
    }

    const models = await chatManager.assistant.getAvailableModels();
    if (models.length === 0) {
      ui.displayError('No models found to check.');
      return true;
    }

    const unavailable = [];
    ui.startToolMonitoring('Model Scan', 'Initializing...');

    for (let i = 0; i < models.length; i++) {
      const model = models[i];
      ui.updateMonitoring('Model Scan', `Checking ${i + 1}/${models.length}: ${model}`);
      
      const isAvailable = await chatManager.assistant.checkAvailability(model);
      if (!isAvailable) {
        unavailable.push(model);
      }
    }

    chatManager.configManager.save('unavailable_models', unavailable);
    ui.endToolMonitoring('Model Scan', true, `Scan complete. ${unavailable.length} models unavailable.`);
    ui.displayInfo(`Diagnostic finished. Updated unavailable_models list (${unavailable.length} entries).`);
    
    return true;
  }
}