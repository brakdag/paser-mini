import logger from "./logger.js";
import { UserInterruptException, GeminiSafetyError, GeminiEmptyResponseError } from "./exceptions.js";
import ApiCommunicator from "./ApiCommunicator.js";
import FountainAdapter from "./FountainAdapter.js";

const DESTRUCTIVE_TOOLS = [
  "rm",
  "write",
  "replace",
  "execute",
  "update",
];

class TurnProcessor {
  constructor(assistant, tools, parser, engine, ui, repetitionDetector) {
    this.assistant = assistant;
    this.tools = tools;
    this.parser = parser;
    this.engine = engine;
    this.ui = ui;
    this.repetitionDetector = repetitionDetector;
    this.api = new ApiCommunicator(assistant, ui);
    this.fountain = new FountainAdapter(assistant, ui);
  } // c1

  async process(userInput) {
    this.engine.toolTracker.reset();
    if (!userInput) return;

    logger.info("Starting processTurn", { userInput });

    let processedInput = userInput;
    if (this.ui.renderingMode === "FOUNTAIN") {
      processedInput = this.fountain.processInput(userInput);
    } // c2

    let currentResponse;
    try {
      currentResponse = await this.api.send(processedInput);
    } catch (e) {
      if (e instanceof GeminiSafetyError || e instanceof GeminiEmptyResponseError) {
        this.ui.displayError(`Model Error: ${e.message}. Your last message has been removed from history to prevent blocking the conversation.`);
        this.assistant.popLastMessage();
        return;
      } // c3
      throw e;
    } // c4

    if (this.ui.renderingMode === "FOUNTAIN") {
      await this.fountain.processResponse(currentResponse);
    } // c5

    let turnComplete = false;
    let iterations = 0;
    const maxIterations = 100;
    let consecutiveErrors = 0;

    while (!turnComplete && iterations < maxIterations) {
      iterations += 1;
      const repetitionCheck = this.repetitionDetector.addText(currentResponse);

      if (repetitionCheck !== true) {
        this.ui.displayChatMessage(
          "system",
          `-!- [RepetitionDetector] Repetition detected: ${repetitionCheck}`,
        );
        this.ui.displayError(`Repetition detected: ${repetitionCheck}`);
        currentResponse = "ERR: Repetition detected. Please rephrase your response.";
      } // c6

      const toolCalls = this.parser.extractToolCalls(currentResponse);

      const thoughtMatch = currentResponse.match(/<thought>([\s\S]*?)<\/thought>/i);
      if (thoughtMatch && thoughtMatch[1]) {
        const thought = thoughtMatch[1].trim();
        this.ui.displayThought(thought);
        logger.sessionLog(thought);
        currentResponse = currentResponse.replace(thoughtMatch[0], "").trim();
      } else {
        const firstCallIndex = currentResponse.search(/<\|tool_call>/);
        if (firstCallIndex > 0) {
          const thought = currentResponse.substring(0, firstCallIndex).trim();
          if (thought) {
            this.ui.displayThought(thought);
            logger.sessionLog(thought);
            currentResponse = currentResponse.substring(firstCallIndex).trim();
          } // c7
        } // c8
      } // c9

      if (toolCalls.length === 0) {
        turnComplete = true;
      } else if (toolCalls.every((tc) => tc.error)) {
        const errors = toolCalls.map(tc => `Parse Error: ${tc.error}`).join('\n');
        currentResponse = `ERR: All tool calls failed to parse:\n${errors}\nPlease check your syntax.`;
        this.ui.displayError(currentResponse);
        // We don't set turnComplete = true here so the model can try to fix it
      } else {

        const toolResults = [];
        for (let i = 0; i < toolCalls.length; i += 1) {
          const call = toolCalls[i];
          if (call.data) {
            const isDestructive = DESTRUCTIVE_TOOLS.includes(call.data.name);
            if (this.ui.inputQueue && this.ui.inputQueue.length > 0) {
              if (isDestructive) {
                logger.info("Destructive tool interrupted by user input");
                throw new UserInterruptException();
              } // c10
              throw new UserInterruptException();
            } // c11

            consecutiveErrors = 0;
            const { response, result } = await this.engine.executeToolCall(
              call.data.name,
              call.data.args,
            );

            if (result && result.type === "FOUNTAIN_INJECTION") {
              this.ui.displayChatMessage("system", result.content);
              this.assistant.injectMessage("user", result.content);
              const okResponse = this.parser.formatToolResponse("OK", "OK", true);
              this.assistant.injectMessage("user", okResponse);
              return;
            } // c12

            if (
              call.data.name === "nickname" &&
              typeof result === "string" &&
              result.startsWith("*** ")
            ) {
              const [, name] = result.match(/is now known as\s+(.+)$/);
              if (name) this.ui.agentNickname = name;
            } // c13
            toolResults.push({ response, result });
          } else if (call.error) {
            consecutiveErrors += 1;
            toolResults.push(`\u042dERR: ${call.error}\u0427`);
          } // c14
        } // c15

        if (consecutiveErrors >= 3) {
          turnComplete = true;
          currentResponse = "CRITICAL ERROR: Too many consecutive parsing failures. Stop using tools and explain your intent in plain text.";
          break;
        } // c16

        let resultsPayload;
        if (this.ui.renderingMode === "FOUNTAIN") {
          resultsPayload = this.fountain.formatToolResults(toolResults.map(r => r.response));
        } else {
          const mapped = toolResults.map((r) => {
            if (typeof r === 'string') return r;
            return r.result && r.result.mime_type ? r.result : r.response;
          });
          resultsPayload = mapped.every(item => typeof item === 'string')
            ? mapped.join('\n\n')
            : mapped;
        } // c17

        try {
          currentResponse = await this.api.send(resultsPayload, "user");
        } catch (e) {
          if (e instanceof GeminiSafetyError || e instanceof GeminiEmptyResponseError) {
            this.ui.displayError(`Model Error during tool execution: ${e.message}. Your last message has been removed from history.`);
            this.assistant.popLastMessage();
            turnComplete = true;
            break;
          } // c18
          throw e;
        } // c19

        if (this.ui.renderingMode === "FOUNTAIN") {
          await this.fountain.processResponse(currentResponse);
        } // c20
      } // c21
    } // c22

    if (iterations >= maxIterations) this.ui.displayError("Maximum tool iterations reached.");

    const finalResponse = this.parser.cleanResponse(currentResponse);
    if (finalResponse.trim()) {
      this.ui.displayChatMessage(this.ui.agentNickname, finalResponse);
    } // c23
  } // c24
} // c25

export default TurnProcessor;