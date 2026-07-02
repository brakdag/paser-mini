import logger from './logger.js';
import { GeminiSafetyError, GeminiEmptyResponseError } from './exceptions.js';
import ApiCommunicator from './ApiCommunicator.js';
import FountainAdapter from './FountainAdapter.js';
import ThoughtExtractor from './thoughtExtractor.js';
import ToolExecutor from './toolExecutor.js';

const MAX_TOOL_ITERATIONS = 50;
const MAX_CONSECUTIVE_ERRORS = 5;

/**
 * Processes turns.
 */
class TurnProcessor {
  /**
   * Constructor.
   */
  constructor(assistant, tools, parser, engine, ui, repetitionDetector) {
    this.assistant = assistant;
    this.tools = tools;
    this.parser = parser;
    this.engine = engine;
    this.ui = ui;
    this.repetitionDetector = repetitionDetector;
    this.api = new ApiCommunicator(assistant, ui);
    this.fountain = new FountainAdapter(assistant, ui);
  }

  /**
   * Process input.
   */
  async process(userInput) {
    this.engine.toolTracker.reset();
    if (!userInput) return;
    logger.info('Starting processTurn', { userInput });

    let processedInput = userInput;
    if (this.ui.renderingMode === 'FOUNTAIN') {
      processedInput = this.fountain.processInput(userInput);
    }

    let currentResponse = await this.#sendInitialRequest(processedInput);

    if (this.ui.renderingMode === 'FOUNTAIN') {
      await this.fountain.processResponse(currentResponse);
    }

    let turnComplete = false;
    let iterations = 0;
    let consecutiveErrors = 0;

    while (!turnComplete && iterations < MAX_TOOL_ITERATIONS) {
      iterations += 1;
      const repetitionCheck = this.repetitionDetector.addText(currentResponse);

      if (repetitionCheck !== true) {
        currentResponse = await this.#handleRepetition(repetitionCheck);
      } else {
        currentResponse = ThoughtExtractor.extract(currentResponse, this.ui);
        const toolCalls = this.parser.extractToolCalls(currentResponse);

        if (toolCalls.length === 0) {
          turnComplete = true;
        } else {
          const executionResult = await ToolExecutor.execute(toolCalls, this.engine, this.ui, this.assistant, this.parser);
          if (executionResult.terminate) return;
          consecutiveErrors += executionResult.errorCount;

          if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
            currentResponse = await this.api.send(`CRITICAL ERROR: Too many consecutive parsing failures. Stop using tools.`, 'user');
            consecutiveErrors = 0;
          } else {
            const resultsPayload = this.#buildResultsPayload(executionResult.results);
            currentResponse = await this.#sendToolResults(resultsPayload);
            if (this.ui.renderingMode === 'FOUNTAIN') {
              await this.fountain.processResponse(currentResponse);
            }
          }
        }
      }
    }

    if (iterations >= MAX_TOOL_ITERATIONS) {
      this.ui.displayError('Maximum tool iterations reached.');
    }

    const finalResponse = this.parser.cleanResponse(currentResponse);
    if (finalResponse.trim()) {
      this.ui.displayChatMessage(this.ui.agentNickname, finalResponse);
    }
  }

  /**
   * Send initial request.
   */
  async #sendInitialRequest(processedInput) {
    try {
      return this.api.send(processedInput);
    } catch (e) {
      if (e instanceof GeminiSafetyError || e instanceof GeminiEmptyResponseError) {
        this.ui.displayError(`Model Error: ${e.message}. Last message removed.`);
        this.assistant.popLastMessage();
        return this.api.send('Model Error: Safety or Empty response. Please rephrase.', 'user');
      }
      throw e;
    }
  }

  /**
   * Handle repetition.
   */
  async #handleRepetition(repetitionCheck) {
    this.ui.displayChatMessage('system', `-!- Repetition detected: ${repetitionCheck}`);
    this.ui.displayError(`Repetition detected: ${repetitionCheck}`);
    return this.api.send('ERR: Repetition detected. Please rephrase.', 'user');
  }

  /**
   * Build payload.
   */
  #buildResultsPayload(toolResults) {
    if (this.ui.renderingMode === 'FOUNTAIN') {
      return this.fountain.formatToolResults(toolResults.map((r) => r.response));
    }
    const mapped = toolResults.map((r) => {
      if (typeof r === 'string') return r;
      return r.result && r.result.mime_type ? r.result : r.response;
    });
    const sep = String.fromCharCode(10, 10);
    return mapped.every((item) => typeof item === 'string') ? mapped.join(sep) : mapped;
  }

// removed debris

  /**
   * Send results.
   */
  async #sendToolResults(resultsPayload) {
    try {
      return this.api.send(resultsPayload, 'user');
    } catch (e) {
      if (e instanceof GeminiSafetyError || e instanceof GeminiEmptyResponseError) {
        this.ui.displayError(`Model Error during tool execution: ${e.message}`);
        this.assistant.popLastMessage();
        return this.api.send('Model Error during tool execution. Please rephrase.', 'user');
      }
      throw e;
    }
  }
}

export default TurnProcessor;