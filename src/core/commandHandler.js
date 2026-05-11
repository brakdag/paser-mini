import { SystemCommands } from './commandHandlers/system.js';
import { ModelCommands } from './commandHandlers/models.js';
import { ConfigCommands } from './commandHandlers/config.js';
import { FavoriteCommands } from './commandHandlers/favorites.js';
import { SessionCommands } from './commandHandlers/session.js';
import { InterfaceCommands } from './commandHandlers/interface.js';
import { AICommands } from './commandHandlers/ai.js';

const COMMAND_MAP = {
  '/q': (cm, ui) => SystemCommands.handleExit(cm),
  '/quit': (cm, ui) => SystemCommands.handleExit(cm),
  '/exit': (cm, ui) => SystemCommands.handleExit(cm),
  ':q': (cm, ui) => SystemCommands.handleExit(cm),
  '/reset': SystemCommands.handleReset,
  '/clear': (cm, ui) => SystemCommands.handleClear(ui),
  '/kick': SystemCommands.handleKick,
  '/enablebash': SystemCommands.handleEnableBash,
  '/compact': SessionCommands.handleCompact,
  '/fountain': InterfaceCommands.handleFountain,
  '/irc': InterfaceCommands.handleIRC,
  '/clean': InterfaceCommands.handleClean,
  '/help': (cm, ui) => InterfaceCommands.handleHelp(ui),
  '/connect': AICommands.handleConnect,
  '/config': ConfigCommands.handleConfig
};

export class CommandHandler {
  constructor(chatManager, ui) {
    this.chatManager = chatManager;
    this.ui = ui;
  }

  _handleWindowConfig(input) {
    const parts = input.split(/\s+/);
    if (parts.length !== 4) {
      this.ui.displayError('Usage: /w <tokens> <rpm_limit> <tpm_limit>');
      return true;
    }
    const [, tokens, rpm, tpm] = parts.map(p => parseInt(p, 10));
    this.chatManager.configManager.save('context_window_limit', tokens);
    this.chatManager.configManager.save('rpm_limit', rpm);
    this.chatManager.configManager.save('tpm_limit', tpm);
    this.ui.displayInfo(`Context window: ${tokens} | RPM: ${rpm} | TPM: ${tpm}`);
    return true;
  }

  async handle(userInput) {
    const input = userInput.trim();
    const lowerInput = input.toLowerCase();

    if (COMMAND_MAP[lowerInput]) return COMMAND_MAP[lowerInput](this.chatManager, this.ui);

    if (input.startsWith('/r ')) return SessionCommands.handleRewrite(this.chatManager, this.ui, input.slice(3).trim());
    if (input.startsWith('/s ')) return SessionCommands.handleSavePayload(this.chatManager, this.ui, input.slice(3).trim() || 'last_request.json');
    if (input.startsWith('/topic ')) return InterfaceCommands.handleTopic(this.chatManager, this.ui, input.slice(7).trim());
    if (input.startsWith('/nick ')) return InterfaceCommands.handleNick(this.chatManager, this.ui, input.slice(6).trim());
    if (input.startsWith('/me ')) return InterfaceCommands.handleMe(this.chatManager, this.ui, input.slice(4).trim());
    if (input.startsWith('/action ')) return InterfaceCommands.handleAction(this.chatManager, this.ui, input.slice(8).trim());
    if (input.startsWith('/join ')) return InterfaceCommands.handleJoin(this.chatManager, this.ui, input.slice(6).trim());
    if (input.startsWith('/paim ')) return AICommands.handlePaim(this.chatManager, this.ui, input.slice(6).trim());
    if (input.startsWith('/models')) return ModelCommands.handleModels(this.chatManager, this.ui, input.split(/\s+/));
    if (input.startsWith('/fav')) return FavoriteCommands.handleFav(this.chatManager, this.ui, input.split(/\s+/));
    if (input.startsWith('/w ')) return this._handleWindowConfig(input);

    if (input.startsWith('/') || input.startsWith(':')) {
      this.ui.displayError('Invalid command. See /help for available commands.');
      return true;
    }

    return false;
  }
}