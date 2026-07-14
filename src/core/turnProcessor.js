import logger from './logger.js';
import { GeminiSafetyError, GeminiEmptyResponseError } from './exceptions.js';
import ApiCommunicator from './ApiCommunicator.js';
import ThoughtExtractor from './thoughtExtractor.js';
import ToolExecutor from './toolExecutor.js';

const MAX_TOOL_ITERATIONS = 50;
const MAX_CONSECUTIVE_ERRORS = 5;

/**
 * Orchestrates the processing of a single turn, including input handling, 
 * tool execution loops, and repetition detection.
 */
class TurnProcessor {
  /**
   * Initializes the TurnProcessor with necessary system components.
   * @param {object} assistant The assistant instance managing conversation state.
   * @param {object} tools The tools registry.
   * @param {object} parser The smart parser for tool call extraction.
   * @param {object} engine The execution engine for tool calls.
   * @param {object} ui The terminal user interface instance.
   * @param {object} repetitionDetector The detector for identifying repetitive AI responses.
   */
  constructor(assistant, tools, parser, engine, ui, repetitionDetector) {
    this.assistant = assistant;
    this.tools = tools;
    this.parser = parser;
    this.engine = engine;
    this.ui = ui;
    this.repetitionDetector = repetitionDetector;
    this.api = new ApiCommunicator(assistant, ui);
  }

  /**
   * Processes the user input through the full turn cycle: input processing, 
   * initial request, tool execution loop, and final response cleaning.
   * @param {string} userInput The raw input provided by the user.
   * @returns {Promise<void>} A promise that resolves when the turn is complete.
   */
  async process(userInput) {
    this.engine.toolTracker.reset();
    if (!userInput) return;
    logger.info('Starting processTurn', { userInput });

    let currentResponse = await this.#sendInitialRequest(userInput);

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
          
          if (executionResult.errorCount > 0) {
            consecutiveErrors += executionResult.errorCount;
          } else {
            consecutiveErrors = 0;
          }

          if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
            currentResponse = await this.api.send('CRITICAL ERROR: Too many consecutive parsing failures. Stop using tools.', { role: 'user' });
            consecutiveErrors = 0;
          } else {
            const resultsPayload = this.#buildResultsPayload(executionResult.results);
            currentResponse = await this.#sendToolResults(resultsPayload);
          }
        }
      }
    }

    if (iterations >= MAX_TOOL_ITERATIONS) {
      this.ui.displayError('Maximum tool iterations reached.');
    }

    const finalResponse = this.parser.cleanResponse(currentResponse);
    if (finalResponse.trim()) {
      this.ui.displayChatMessage(this.ui.model.nickname, finalResponse);
    }
  }

  /**
   * Sends the initial processed input to the API and handles safety/empty response errors.
   * @param {string} processedInput The input to send to the API.
   * @returns {Promise<string>} The response from the API.
   */
  async #sendInitialRequest(processedInput) {
    try {
      return this.api.send(processedInput);
    } catch (e) {
      if (e instanceof GeminiSafetyError || e instanceof GeminiEmptyResponseError) {
        this.ui.displayError(`Model Error: ${e.message}. Last message removed.`);
        this.assistant.popLastMessage();
        return this.api.send('Model Error: Safety or Empty response. Please rephrase.', { role: 'user' });
      }
      throw e;
    }
  }

  /**
   * Handles detected repetitions by notifying the user and requesting a rephrase from the model.
   * @param {string} repetitionCheck The detected repetition string or indicator.
   * @returns {Promise<string>} The API response after reporting the repetition.
   */
  async #handleRepetition(repetitionCheck) {
    this.ui.displayChatMessage('system', `-!- Repetition detected: ${repetitionCheck}`);
    this.ui.displayError(`Repetition detected: ${repetitionCheck}`);
    return this.api.send('ERR: Repetition detected. Please rephrase.', { role: 'user' });
  }

  /**
   * Constructs the results payload to be sent back to the model after tool execution.
   * @param {Array} toolResults The results of the tool executions.
   * @returns {string|Array} The formatted payload for the API.
   */
  #buildResultsPayload(toolResults) {
    const mapped = toolResults.map((r) => {
      if (typeof r === 'string') return r;
      return r.result && r.result.mime_type ? r.result : r.response;
    });
    const sep = String.fromCharCode(10, 10);
    return mapped.every((item) => typeof item === 'string') ? mapped.join(sep) : mapped;
  }

  /**
   * Sends the tool results payload to the API and handles potential model errors.
   * @param {string|Array} resultsPayload The payload containing tool execution results.
   * @returns {Promise<string>} The API response after receiving tool results.
   */
  async #sendToolResults(resultsPayload) {
    try {
      return this.api.send(resultsPayload, { role: 'user' });
    } catch (e) {
      if (e instanceof GeminiSafetyError || e instanceof GeminiEmptyResponseError) {
        this.ui.displayError(`Model Error during tool execution: ${e.message}`);
        this.assistant.popLastMessage();
        return this.api.send('Model Error during tool execution. Please rephrase.', { role: 'user' });
      }
      throw e;
    }
  }
}

export default TurnProcessor;
