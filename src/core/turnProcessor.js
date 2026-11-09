import logger from './logger.js';
import { GeminiSafetyError, GeminiEmptyResponseError } from './exceptions.js';
import ApiCommunicator from './ApiCommunicator.js';
import ThoughtExtractor from './thoughtExtractor.js';
import ToolExecutor from './toolExecutor.js';

import TurnControl from './turnControl.js';
import TurnLimitError from './exceptions/TurnLimitError.js';

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
   * @param {object} [limits] Programmatic turn scheduling limits.
   */
  constructor(assistant, tools, parser, engine, ui, repetitionDetector, limits = {}) {
    this.assistant = assistant;
    this.tools = tools;
    this.parser = parser;
    this.engine = engine;
    this.ui = ui;
    this.repetitionDetector = repetitionDetector;
    this.api = new ApiCommunicator(assistant, ui);
    this.limits = limits;
    /** @type {TurnControl|null} */
    this.control = null;
  }

  /**
   * Processes the user input through the full turn cycle: input processing, 
   * initial request, tool execution loop, and final response cleaning.
   * @param {string} userInput The raw input provided by the user.
   * @returns {Promise<void>} A promise that resolves when the turn is complete.
   */
  async process(userInput) {
    if (!userInput) return;
    if (this.control) throw new Error('A turn is already active.');
    this.engine.toolTracker.reset();
    this.repetitionDetector.reset();
    this.control = new TurnControl(this.ui, this.limits);
    try {
      this.assistant.beginContextTurn?.();
      await this.#processTurn(userInput);
    } catch (error) {
      if (!(error instanceof TurnLimitError)) throw error;
      this.ui.displayError(error.message);
    } finally {
      this.assistant.endContextTurn?.();
      this.control = null;
    }
  }

  /** Cancels pending requests and prevents the next action, including during tool execution. */
  cancelPendingTurn() {
    if (this.control) this.control.cancelled = true;
    this.api.cancelPendingRequest();
  }

  /**
   * Runs a turn under its shared budget.
   * @param {string} userInput The submitted input.
   */
  async #processTurn(userInput) {
    logger.info('Starting processTurn', { userInput });
    let currentResponse = await this.#sendInitialRequest(userInput);
    this.control.check();
    if (this.engine.strictPureMode) {
      if (currentResponse.trim()) await this.ui.displayChatMessage(this.ui.model.nickname, currentResponse);
      return;
    }
    while (true) {
      this.control.check();
      const repetitionCheck = this.repetitionDetector.addText(currentResponse);
      if (repetitionCheck !== true) {
        currentResponse = await this.#handleRepetition(repetitionCheck);
      } else {
        currentResponse = ThoughtExtractor.extract(currentResponse, this.ui);
        const toolCalls = this.parser.extractToolCalls(currentResponse);
        if (toolCalls.length === 0) break;
        const executionResult = await ToolExecutor.execute(toolCalls, this.engine, this.ui, this.assistant, this.parser, this.control);
        if (executionResult.terminate) return;
        currentResponse = await this.#sendToolResults(this.#buildResultsPayload(executionResult.results));
      }
    }
    this.control.check();
    const finalResponse = this.parser.cleanResponse(currentResponse);
    if (finalResponse.trim()) await this.ui.displayChatMessage(this.ui.model.nickname, finalResponse);
  }

  /**
   * Applies the shared budget to every exchange, including recovery.
   * @param {string|Array} message The content to send.
   * @param {object} [options] Send options.
   * @returns {Promise<string>} The model response.
   */
  async #send(message, options = {}) {
    this.control.beforeRequest();
    const response = await this.api.send(message, options);
    this.control.check();
    return response;
  }

  /**
   * Sends the initial processed input to the API and handles safety/empty response errors.
   * @param {string} processedInput The input to send to the API.
   * @returns {Promise<string>} The response from the API.
   */
  async #sendInitialRequest(processedInput) {
    try {
      return await this.#send(processedInput);
    } catch (e) {
      if (e instanceof GeminiSafetyError || e instanceof GeminiEmptyResponseError) {
        this.ui.displayError(`Model Error: ${e.message}. Last message removed.`);
        return this.#send('Model Error: Safety or Empty response. Please rephrase.', { role: 'user' });
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
    return this.#send('ERR: Repetition detected. Please rephrase.', { role: 'user' });
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
    const sep = "\n\n";
    return mapped.every((item) => typeof item === 'string') ? mapped.join(sep) : mapped;
  }

  /**
   * Sends the tool results payload to the API and handles potential model errors.
   * @param {string|Array} resultsPayload The payload containing tool execution results.
   * @returns {Promise<string>} The API response after receiving tool results.
   */
  async #sendToolResults(resultsPayload) {
    try {
      return await this.#send(resultsPayload, { role: 'user' });
    } catch (e) {
      if (e instanceof GeminiSafetyError || e instanceof GeminiEmptyResponseError) {
        this.ui.displayError(`Model Error during tool execution: ${e.message}`);
        return this.#send('Model Error during tool execution. Please rephrase.', { role: 'user' });
      }
      throw e;
    }
  }
}

export default TurnProcessor;
