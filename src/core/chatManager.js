import { SmartToolParser } from './smartParser.js';
import { ExecutionEngine } from './executionEngine.js';
import { CommandHandler } from './commandHandler.js';
import { RepetitionDetector } from './repetitionDetector.js';
import { logger } from './logger.js';
import { ConfigManager } from './configManager.js';
import { TurnProcessor } from './turnProcessor.js';
import { HistoryManager } from './historyManager.js';
import * as memoryTools from '../tools/memoryTools.js';

export class ChatManager {
  constructor(assistant, tools, systemInstruction, ui, instanceMode = false) {
    this.assistant = assistant;
    this.tools = tools;
    this.systemInstruction = systemInstruction;
    this.ui = ui;
    this.instanceMode = instanceMode;

    // Configuration Integration
    this.configManager = new ConfigManager();
    this.temperature = parseFloat(
      this.configManager.get('default_temperature', 0.7)
    );
    this.contextWindowLimit = parseInt(
      this.configManager.get('context_window_limit', 250000)
    );
    this.tpmLimit = parseInt(this.configManager.get('tpm_limit', 15000));

    this.ui.bashEnabled = false;
    this.currentChannel = '#main';
    this.timestampsEnabled = this.configManager.get(
      'timestamps_enabled',
      false
    );
    this.safemode = this.configManager.get('safemode', false);

    this.parser = new SmartToolParser();
    this.engine = new ExecutionEngine(
      assistant,
      tools,
      this.parser,
      ui,
      instanceMode,
      null,
      this.systemInstruction === ''
    );
    this.commandHandler = new CommandHandler(this, ui);
    this.repetitionDetector = new RepetitionDetector();

    // New Specialized Modules
    this.turnProcessor = new TurnProcessor(
      assistant,
      tools,
      this.parser,
      this.engine,
      ui,
      this.repetitionDetector
    );
    this.historyManager = new HistoryManager(
      assistant,
      ui,
      this.configManager
    );

    // Load agent nickname from config
    const agentNickname = this.configManager.get('agent_nickname', 'paser_mini');
    this.ui.agentNickname = agentNickname;
    const userNickname = this.configManager.get('user_nickname', 'user');
    this.ui.userNickname = userNickname;

    // Rendering Mode Persistence
    const currentMode = this.configManager.get('rendering_mode', 'IRC');
    this.setRenderingMode(currentMode);

    this.stopRequested = false;
    this.logOpened = false;
  }

  saveConfig(key, value) {
    if (this.instanceMode) {
      this.configManager.config[key] = value;
      return;
    }
    this.configManager.save(key, value);
  }

  setRenderingMode(mode) {
    this.saveConfig('rendering_mode', mode);
    this.ui.setRenderingMode(mode);
    if (this.assistant) {
      if (this.assistant.setRenderingMode) {
        this.assistant.setRenderingMode(mode);
      } else if (this.assistant.state && this.assistant.state.setRenderingMode) {
        this.assistant.state.setRenderingMode(mode);
      }
    }
  }

  async switchProvider(provider, model, temperature) {
    const oldAssistant = this.assistant;
    let newAssistant;

    if (provider === 'NVIDIA') {
      const { NvidiaAdapter } = await import('../infrastructure/nvidia/adapter.js');
      newAssistant = new NvidiaAdapter();
    } else {
      const { GeminiAdapter } = await import('../infrastructure/gemini/adapter.js');
      newAssistant = new GeminiAdapter();
    }

    // Migrate history
    if (oldAssistant && oldAssistant.getHistory) {
      const history = oldAssistant.getHistory();
      if (history && history.length > 0) {
        history.forEach(msg => {
      const text = msg.text || (msg.parts && msg.parts[0] && msg.parts[0].text) || '';
      newAssistant.injectMessage(msg.role, text);
    });
      }
    }

    this.assistant = newAssistant;
    this.assistant.startChat(model, this.systemInstruction, temperature);

    // Synchronize references
    if (this.turnProcessor) this.turnProcessor.assistant = newAssistant;
    if (this.engine) this.engine.assistant = newAssistant;

    logger.info(`Provider switched to ${provider} | Model: ${model}`);
  }

  async run(initialInput = null) {
    logger.info('Initializing ChatManager.run');

    const model = this.configManager.get('model_name', 'gemini-2.0-flash');
    this.assistant.startChat(model, this.systemInstruction, this.temperature);

    this.ui.clearLog();

    if (initialInput) {
      const logMsg = this.ui.getLogOpenedString();
      this.ui.displayChatMessage('system', logMsg);
      this.ui.displayChatMessage(
        'system',
        '*** Session resumed from ./session_history.log'
      );
      this.logOpened = true;
      this.assistant.injectMessage('server', logMsg);
      await this.processTurn(initialInput);
    }

    if (this.ui.initInput) {
      this.ui.initInput();
    }

    while (!this.stopRequested) {
      try {
        let input = await this.ui.requestInput();
        if (!input) {
          continue;
        }

        if (!this.logOpened && this.systemInstruction) {
          const logMsg = this.ui.getLogOpenedString();
          this.ui.displayChatMessage('system', logMsg);
          this.ui.displayChatMessage(
            'system',
            '*** Session resumed from ./session_history.log'
          );
          this.logOpened = true;
          const formattedLog = this.ui.renderingMode === 'FOUNTAIN' 
          ? this.ui._renderFountain('system', logMsg) 
          : logMsg;
        this.assistant.injectMessage('server', formattedLog);
        }

        if (await this.commandHandler.handle(input)) {
          if (this.stopRequested) {
            break;
          }
          continue;
        }

        this.ui.displayChatMessage(this.ui.userNickname, input);
        await this.processTurn(input);
      } catch (e) {
        if (e.name === 'UserInterruptException') {
          logger.info('Turn interrupted by user input');
          this.ui.displayInfo('Agent interrupted. Processing new request...');
        } else {
          this.ui.displayError('Critical error in processTurn: ' + e.message);
          console.error(e);
        }
      }
    }
  }

  async processTurn(userInput) {
    return await this.turnProcessor.process(userInput);
  }

  stopExecution() {
    this.stopRequested = true;
  }
}