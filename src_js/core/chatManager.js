import { SmartToolParser } from './smartParser.js';
import { ExecutionEngine } from './executionEngine.js';
import { CommandHandler } from './commandHandler.js';
import { RepetitionDetector } from './repetitionDetector.js';
import { LatexTranslator } from './latexTranslator.js';
import { logger } from './logger.js';
import { ConfigManager } from './configManager.js';

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
    this.thinkingEnabled = this.configManager.get('thinking_enabled', false);
    this.timestampsEnabled = this.configManager.get('timestamps_enabled', false);
    this.safemode = this.configManager.get('safemode', false);
    
    this.parser = new SmartToolParser();
    this.engine = new ExecutionEngine(assistant, tools, this.parser, ui, instanceMode);
    this.commandHandler = new CommandHandler(this, ui);
    this.repetitionDetector = new RepetitionDetector();
    
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
      
      // Inyectamos el log de apertura como mensaje de servidor para evitar prefijos de usuario
      this.assistant.injectMessage('server', logMsg);
      
      // Enviamos el input inicial raw
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
        // El log de apertura es un evento de sistema, no un mensaje de usuario
        this.assistant.injectMessage('server', logMsg);
      }

      if (await this.commandHandler.handle(input)) {
        if (this.stopRequested) break;
        continue;
      }

      try {
        // Eliminamos el eco del input para evitar duplicación visual en la terminal
        // Enviamos solo el input puro. El adaptador se encarga del formato IRC.
        await this.processTurn(input);
      } catch (e) {
        this.ui.displayError('Critical error in processTurn: ' + e.message);
        console.error(e);
      }
    }
  }

  async processTurn(userInput) {
    if (!userInput) return;

    
    logger.info('Starting processTurn', { userInput });
    let currentResponse = await this.assistant.sendMessage(userInput);
    logger.debug('Received response from assistant', { responseLength: currentResponse?.length });
    
    let turnComplete = false;
    let iterations = 0;
    const maxIterations = 10;
    let consecutiveErrors = 0;

    while (!turnComplete && iterations < maxIterations) {
      iterations++;
      const repetitionCheck = this.repetitionDetector.addText(currentResponse);
      if (repetitionCheck !== true) {
        this.ui.displayError('Repetition detected: ' + repetitionCheck);
        currentResponse = 'ERR: Repetition detected. Please rephrase your response.';
      }

      const toolCalls = this.parser.extractToolCalls(currentResponse);
      if (toolCalls.length === 0 || toolCalls.every(tc => tc.error)) {
        turnComplete = true;
      } else {
        let toolResults = [];
        for (const call of toolCalls) {
          if (call.data) {
            consecutiveErrors = 0; 
            const { response, result } = await this.engine.executeToolCall(call.data.name, call.data.args, { id: call.data.id });
            if (call.data.name === 'setNickname' && typeof result === 'string' && result.startsWith('*** ')) {
              const match = result.match(/is now known as\s+(.+)$/);
              if (match) {
                this.ui.agentNickname = match[1];
              }
            }
            toolResults.push(response);
          } else if (call.error) {
            consecutiveErrors++;
            toolResults.push(`<TOOL_RESPONSE>ERR: ${call.error}</TOOL_RESPONSE>`);
          }
        }

        if (consecutiveErrors >= 3) {
          turnComplete = true;
          currentResponse = 'CRITICAL ERROR: Too many consecutive JSON validation failures. Stop using tools and explain your intent in plain text.';
          break;
        }
        currentResponse = await this.assistant.sendMessage(toolResults.join('\n'), 'user');
      }
    }

    if (iterations >= maxIterations) this.ui.displayError('Maximum tool iterations reached.');

    const finalResponse = LatexTranslator.translate(currentResponse);
    this.ui.displayChatMessage(this.ui.agentNickname, finalResponse);
  }

  stopExecution() {
    this.stopRequested = true;
  }


  async compactHistory() {
    try {
      const fs = await import('fs/promises');
      const logContent = await fs.readFile('session.log', 'utf8');
      
      if (!logContent || logContent.trim() === '') {
        this.ui.displayError('No log file found to compact.');
        return true;
      }

      const log = `--- Session History Compaction ---\n${logContent}\n--- End of Compaction ---`;

      // Hard reset the assistant to clear context window
      this.assistant.hardReset();

      // Send the compacted log as the first user message
      const prompt = `The following is a log of our previous conversation for context:\n\n${log}\n\nContinue from here.`;
      await this.processTurn(prompt);
      
      this.ui.displayInfo('History compacted and context window reset.');
      return true;
    } catch (e) {
      this.ui.displayError('Error during compaction: ' + e.message);
      return true;
    }
  }
}