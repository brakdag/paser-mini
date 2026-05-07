import { LatexTranslator } from './latexTranslator.js';
import { logger } from './logger.js';

export class TurnProcessor {
  constructor(assistant, tools, parser, engine, ui, repetitionDetector) {
    this.assistant = assistant;
    this.tools = tools;
    this.parser = parser;
    this.engine = engine;
    this.ui = ui;
    this.repetitionDetector = repetitionDetector;
  }

  async process(userInput) {
    if (!userInput) return;

    logger.info('Starting processTurn', { userInput });
    let currentResponse = await this.assistant.sendMessage(userInput);

    // Guard against null/filtered responses (NVIDIA/Gemini safety filters)
    const isSafetyBlock = currentResponse === null || 
                           currentResponse === 'null' || 
                           (typeof currentResponse === 'string' && (currentResponse.includes('safety block') || currentResponse.includes('blocked by safety filters')));

    if (isSafetyBlock) {
      this.ui.displayError('The model response was filtered by safety guards. Your last message has been removed from history to prevent blocking the conversation. Please rephrase your request.');
      this.assistant.popLastMessage(); // Remove the triggering message to prevent history poisoning
      return;
    }

    if (currentResponse?.startsWith('Error:')) {
      this.ui.displayError('API Communication Error: ' + currentResponse);
    }
    logger.debug('Received response from assistant', { responseLength: currentResponse?.length });
    
    let turnComplete = false;
    let iterations = 0;
    const maxIterations = 10;
    let consecutiveErrors = 0;

    while (!turnComplete && iterations < maxIterations) {
      iterations++;
      const repetitionCheck = this.repetitionDetector.addText(currentResponse);
      if (repetitionCheck !== true) {
        this.ui.displayChatMessage('system', `-!- [RepetitionDetector] Repetition detected: ${repetitionCheck}`);
        this.ui.displayError('Repetition detected: ' + repetitionCheck);
        currentResponse = 'ERR: Repetition detected. Please rephrase your response.';
      }

      const toolCalls = this.parser.extractToolCalls(currentResponse);

      // UX: Separate reasoning (thought) from action
      const firstCallIndex = currentResponse.search(/<(?:TOOL_CALL|tool_call)\s*>/i);
      if (firstCallIndex !== -1) {
        const thought = currentResponse.substring(0, firstCallIndex);
        if (thought.trim()) {
          this.ui.displayThought(thought.trim());
        }
      }

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

        // Guard against null/filtered responses during tool iterations
        const isSafetyBlock = currentResponse === null || 
                               currentResponse === 'null' || 
                               (typeof currentResponse === 'string' && (currentResponse.includes('safety block') || currentResponse.includes('blocked by safety filters')));

        if (isSafetyBlock) {
          this.ui.displayError('The model response was filtered by safety guards during tool execution. Your last message has been removed from history. Please rephrase your request.');
          this.assistant.popLastMessage(); // Remove the triggering message to prevent history poisoning
          turnComplete = true;
          break;
        }

        if (currentResponse?.startsWith('Error:')) {
          this.ui.displayError('API Communication Error during tool processing: ' + currentResponse);
          currentResponse = 'ERR: The system encountered a temporary API error. Please repeat your last tool call or request.';
        }
      }
    }

    if (iterations >= maxIterations) this.ui.displayError('Maximum tool iterations reached.');

    const cleanedResponse = this.parser.cleanResponse(currentResponse);
    const finalResponse = LatexTranslator.translate(cleanedResponse);
    if (finalResponse.trim()) {
      this.ui.displayChatMessage(this.ui.agentNickname, finalResponse);
    }
  }
}