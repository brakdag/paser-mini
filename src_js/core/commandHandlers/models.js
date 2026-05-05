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
}