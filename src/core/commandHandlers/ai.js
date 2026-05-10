export class AICommands {
  static async handlePaim(chatManager, ui, message) {
    const content = ui.renderingMode === 'FOUNTAIN' 
      ? ui._renderFountain(ui.agentNickname, message) 
      : message;
    chatManager.assistant.injectMessage('model', content);
    ui.displayChatMessage(ui.agentNickname, message);
    return true;
  }

  static async handleConnect(chatManager, ui) {
    ui.displayMessage('Select Provider:\n0: Gemini\n1: NVIDIA');
    const choice = await ui.requestInput('Provider: ');
    
    let provider, model;
    if (choice === '0') {
      provider = 'Gemini';
      model = 'gemini-2.0-flash';
    } else if (choice === '1') {
      provider = 'NVIDIA';
      model = 'meta/llama-3.1-405b-instruct';
    } else {
      ui.displayError('Invalid provider.');
      return true;
    } 

    await chatManager.switchProvider(provider, model, chatManager.temperature);
    chatManager.configManager.save('provider', provider);
    chatManager.configManager.save('model_name', model);
    ui.displayInfo(`Connected to ${provider}`);
    return true;
  }
}