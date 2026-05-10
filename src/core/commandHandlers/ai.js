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
    const { GeminiAdapter } = await import('../infrastructure/gemini/adapter.js');
    const { NvidiaAdapter } = await import('../infrastructure/nvidia/adapter.js');
    ui.displayMessage('Select Provider:\n0: Gemini\n1: NVIDIA');
    const choice = await ui.requestInput('Provider: ');
    if (choice === '0') {
      chatManager.assistant = new GeminiAdapter();
      chatManager.configManager.save('provider', 'Gemini');
      ui.displayInfo('Connected to Gemini');
    } else if (choice === '1') {
      chatManager.assistant = new NvidiaAdapter();
      chatManager.configManager.save('provider', 'NVIDIA');
      ui.displayInfo('Connected to NVIDIA');
    } else {
      ui.displayError('Invalid provider.');
      return true;
    }
    return true;
  }
}