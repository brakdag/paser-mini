import { SmartToolParser } from './smartParser.js';
import { ExecutionEngine } from './executionEngine.js';
import { CommandHandler } from './commandHandler.js';
import { RepetitionDetector } from './repetitionDetector.js';
import { LatexTranslator } from './latexTranslator.js';
import readline from 'readline';

export class ChatManager {
  constructor(assistant, tools, systemInstruction, ui, instanceMode = false) {
    this.assistant = assistant;
    this.tools = tools;
    this.systemInstruction = systemInstruction;
    this.ui = ui;
    this.instanceMode = instanceMode;
    
    this.parser = new SmartToolParser();
    this.engine = new ExecutionEngine(assistant, tools, this.parser, ui, instanceMode);
    this.commandHandler = new CommandHandler(this, ui);
    this.repetitionDetector = new RepetitionDetector();
    
    this.stopRequested = false;
  }

  async run(initialInput = null) {
    this.ui.displayInfo('Paser Mini initialized. Type /quit to exit.');
    this.assistant.startChat('gemini-2.0-flash', this.systemInstruction);
    
    // Vincular contexto para herramientas de memoria (get_token_count)
    import('./../tools/memoryTools.js').then(m => m.setMemoryContext(this.assistant, this));

    if (initialInput) await this.processTurn(initialInput);

    this.rl = readline.createInterface({ input: process.stdin, output: process.stdout });

    // Keep-alive to prevent premature process exit
    const heartbeat = setInterval(() => {}, 1000);
    this.heartbeat = heartbeat;

    while (!this.stopRequested) {
      const input = await this.ui.requestInput(this.rl, '');
      
      if (!input) continue;

      if (await this.commandHandler.handle(input)) {
        if (this.stopRequested) break;
        continue;
      }

      try {
        await this.processTurn(input);
      } catch (e) {
        this.ui.displayError('Critical error in processTurn: ' + e.message);
        console.error(e);
      }
    }
  }

  async processTurn(userInput) {
    if (!userInput) return;
    this.ui.displayMessage('\nUser: ' + userInput);
    
    console.log('[DEBUG] Sending message to assistant...');
    let currentResponse = await this.assistant.sendMessage(userInput);
    console.log('[DEBUG] Received response from assistant.');
    let turnComplete = false;
    let iterations = 0;
    const maxIterations = 10;

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
            const { response } = await this.engine.executeToolCall(call.data.name, call.data.args, { id: call.data.id });
            toolResults.push(response);
          } else if (call.error) {
            toolResults.push(`<TOOL_RESPONSE>ERR: ${call.error}</TOOL_RESPONSE>`);
          }
        }
        currentResponse = await this.assistant.sendMessage(toolResults.join('\n'), 'user');
      }
    }

    if (iterations >= maxIterations) this.ui.displayError('Maximum tool iterations reached.');

    // Aplicar traducción de LaTeX antes de mostrar la respuesta final
    const finalResponse = LatexTranslator.translate(currentResponse);
    this.ui.displayMessage('\nAssistant: ' + finalResponse);
  }

  stopExecution() {
    this.stopRequested = true;
  }
}