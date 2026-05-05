import { SystemCommands } from './commandHandlers/system.js';
import { ModelCommands } from './commandHandlers/models.js';
import { ConfigCommands } from './commandHandlers/config.js';
import { FavoriteCommands } from './commandHandlers/favorites.js';
import { MementoManager } from '../infrastructure/memento/manager.js';
import { GeminiAdapter } from '../infrastructure/gemini/adapter.js';
import { NvidiaAdapter } from '../infrastructure/nvidia/adapter.js';

export class CommandHandler {
  constructor(chatManager, ui) {
    this.chatManager = chatManager;
    this.ui = ui;
  }

  async handle(userInput) {
    const inputStripped = userInput.trim();

    if ([':q', '/q', '/quit', '/exit'].includes(inputStripped.toLowerCase())) {
      return SystemCommands.handleExit(this.chatManager);
    }

    if (inputStripped === '/reset') {
      this.ui.displayInfo('Performing Hard Reset (The Leap)...');
      const manager = new MementoManager();
      const bridge = manager.getLatestBridge();

      let newHistory = [];
      if (bridge) {
        const bridgeMsg = `[MEMENTO LEAP: RESTORED SESSION STATE]\nNode #${bridge.id} | ${bridge.content}`;
        newHistory.push({ role: 'user', parts: [{ text: bridgeMsg }] });
        this.ui.displayInfo(`Bridge Block #${bridge.id} restored.`);
      } else {
        this.ui.displayInfo('No Bridge Block found. Starting fresh.');
      }

      this.chatManager.assistant.hardReset(newHistory);
      return true;
    }

    if (inputStripped.startsWith('/r ')) {
      const newMessage = inputStripped.slice(3).trim();
      const history = this.chatManager.assistant.getHistory();
      if (history.length >= 2) {
        history.pop();
        history.pop();
        this.ui.displayInfo('Last interaction removed. Reprompting...');
        this.chatManager.toolTracker.reset();
        await this.chatManager.processTurn(newMessage);
      } else {
        this.ui.displayError('No interaction to remove.');
      }
      return true;
    }

    if (inputStripped.startsWith('/w ')) {
      const parts = inputStripped.split(/\s+/);
      if (parts.length !== 4) {
        this.ui.displayError('Usage: /w <tokens> <rpm_limit> <tpm_limit>');
        return true;
      }
      try {
        const tokens = parseInt(parts[1], 10);
        const rpm = parseInt(parts[2], 10);
        const tpm = parseInt(parts[3], 10);
        this.chatManager.configManager.save('context_window_limit', tokens);
        this.chatManager.configManager.save('rpm_limit', rpm);
        this.chatManager.configManager.save('tpm_limit', tpm);
        this.ui.displayInfo(`Context window: ${tokens} | RPM: ${rpm} | TPM: ${tpm}`);
      } catch (e) {
        this.ui.displayError('Tokens, RPM, and TPM must be integers.');
      }
      return true;
    }

    if (inputStripped === '/clear') return SystemCommands.handleClear(this.ui);
    if (inputStripped === '/config') return ConfigCommands.handleConfig(this.chatManager, this.ui);
    if (inputStripped.startsWith('/models')) return await ModelCommands.handleModels(this.chatManager, this.ui, inputStripped.split(/\s+/));
    if (inputStripped.startsWith('/fav')) return await FavoriteCommands.handleFav(this.chatManager, this.ui, inputStripped.split(/\s+/));

    if (inputStripped === '/connect') {
      const { GeminiAdapter } = await import('../infrastructure/gemini/adapter.js');
      const { NvidiaAdapter } = await import('../infrastructure/nvidia/adapter.js');

      this.ui.displayMessage('Select Provider:\n0: Gemini\n1: NVIDIA');
      const choice = await this.ui.requestInput(this.chatManager.rl, 'Provider: ');

      if (choice === '0') {
        this.chatManager.assistant = new GeminiAdapter();
        this.chatManager.configManager.save('provider', 'Gemini');
        this.ui.displayInfo('Connected to Gemini');
      } else if (choice === '1') {
        this.chatManager.assistant = new NvidiaAdapter();
        this.chatManager.configManager.save('provider', 'NVIDIA');
        this.ui.displayInfo('Connected to NVIDIA');
      } else {
        this.ui.displayError('Invalid provider.');
        return true;
      }
      return true;
    }

    if (inputStripped === '/help') {
      const helpText = `\nAvailable Commands:\n-------------------\n/help       - Show this help menu\n/config     - Show current system configuration\n/models     - Change AI model and temperature\n/fav        - Manage favorite models (/fav, /fav+, /fav -<idx>, /fav <idx>)\n/reset      - Hard Reset: Clear history and Leap via Bridge Block\n/r <msg>    - Rewrite: Remove last interaction and re-prompt\n/w <t> <r> <p> - Set window, RPM, and TPM\n/clear      - Clear terminal\n/q, /quit, /exit - Exit application\n`;
      this.ui.displayMessage(helpText);
      return true;
    }

    if (inputStripped.startsWith('/') || inputStripped.startsWith(':')) {
      this.ui.displayError('Comando no válido');
      return true;
    }

    return false;
  }
}