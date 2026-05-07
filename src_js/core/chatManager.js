import { SmartToolParser } from './smartParser.js';
import { ExecutionEngine } from './executionEngine.js';
import { CommandHandler } from './commandHandler.js';
import { RepetitionDetector } from './repetitionDetector.js';
import { LatexTranslator } from './latexTranslator.js';
import { logger } from './logger.js';
import { ConfigManager } from './configManager.js';
import { TurnProcessor } from './turnProcessor.js';
import { HistoryManager } from './historyManager.js';
import { registerAllSchemas } from '../tools/schemaRegistry.js';
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
    this.temperature = parseFloat(this.configManager.get('default_temperature', 0.7));
    this.contextWindowLimit = parseInt(this.configManager.get('context_window_limit', 250000));
    this.tpmLimit = parseInt(this.configManager.get('tpm_limit', 15000));
    
    this.ui.bashEnabled = false;
    this.currentChannel = '#main';
    this.timestampsEnabled = this.configManager.get('timestamps_enabled', false);
    this.safemode = this.configManager.get('safemode', false);
    
    this.parser = new SmartToolParser();
    registerAllSchemas(this.parser.validator);
    this.engine = new ExecutionEngine(assistant, tools, this.parser, ui, instanceMode);
    this.commandHandler = new CommandHandler(this, ui);
    this.repetitionDetector = new RepetitionDetector();
    
    // New Specialized Modules
    this.turnProcessor = new TurnProcessor(assistant, tools, this.parser, this.engine, ui, this.repetitionDetector);
    this.historyManager = new HistoryManager(assistant, ui, this.configManager);

    // Load agent nickname from config
    const agentNickname = this.configManager.get('agent_nickname', 'paser_mini');
    this.ui.agentNickname = agentNickname;
    const userNickname = this.configManager.get('user_nickname', 'user');
    this.ui.userNickname = userNickname;
    
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

  async run(initialInput = null) {
    logger.info('Initializing ChatManager.run');

    const model = this.configManager.get('model_name', 'gemini-2.0-flash');
    this.assistant.startChat(model, this.systemInstruction, this.temperature);

    this.ui.clearLog();

    if (initialInput) {
      const logMsg = this.ui.getLogOpenedString();
      this.ui.displayChatMessage(this.ui.userNickname, logMsg);
      this.logOpened = true;
      this.assistant.injectMessage('server', logMsg);
      await this.processTurn(initialInput);
    }

    process.stdin.setEncoding('utf8');
    process.stdin.resume();

    while (!this.stopRequested) {
      let input = await this.ui.requestInput();
      if (!input) continue;

      if (!this.logOpened) {
        const logMsg = this.ui.getLogOpenedString();
        this.ui.displayChatMessage(this.ui.userNickname, logMsg);
        this.logOpened = true;
        this.assistant.injectMessage('server', logMsg);
      }

      if (await this.commandHandler.handle(input)) {
        if (this.stopRequested) break;
        continue;
      }

      try {
        await this.processTurn(input);
        // Proactive Context Management
        await this.checkAndManageContext();
      } catch (e) {
        this.ui.displayError('Critical error in processTurn: ' + e.message);
        console.error(e);
      }
    }
  }

  async processTurn(userInput) {
    return await this.turnProcessor.process(userInput);
  }

  async checkAndManageContext() {
    const tokenStatus = await memoryTools.getTokenCount();
    // Parsing the estimation string: "Current tokens (est.): 100 / 250000 (0.04%)"
    const match = tokenStatus.match(/\((\d+\.?\d*)%\)/);
    if (match) {
      const percentage = parseFloat(match[1]);
      if (percentage > 80) {
        logger.info('Context threshold reached. Triggering proactive compaction.', { percentage });
        await this.compactHistory();
      }
    }
  }

  async compactHistory() {
    const compactionData = await this.historyManager.prepareCompaction();
    if (compactionData) {
      this.assistant.hardReset();
      await this.processTurn(compactionData.prompt);
      this.ui.displayInfo('Context window reset via proactive compaction.');
      return true;
    }
    return false;
  }

  stopExecution() {
    this.stopRequested = true;
  }
}