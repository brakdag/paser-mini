import logger from "./logger.js";
import { UserInterruptException, GeminiSafetyError, GeminiEmptyResponseError } from "./exceptions.js";
import ApiCommunicator from "./ApiCommunicator.js";
import FountainAdapter from "./FountainAdapter.js";

const DESTRUCTIVE_TOOLS = [
  "fs.rm",
  "fs.writeFile",
  "fs.replaceString",
  "child_process.exec",
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
  }

  async process(userInput) {
    this.engine.toolTracker.reset();
    if (!userInput) return;

    logger.info("Starting processTurn", { userInput });

    let processedInput = userInput;
    if (this.ui.renderingMode === "FOUNTAIN") {
      processedInput = this.fountain.processInput(userInput);
    }

    let currentResponse;
    try {
      currentResponse = await this.api.send(processedInput);
    } catch (e) {
      if (e instanceof GeminiSafetyError || e instanceof GeminiEmptyResponseError) {
        this.ui.displayError(`Model Error: ${e.message}. Your last message has been removed from history to prevent blocking the conversation.`);
        this.assistant.popLastMessage();
        return;
      }
      throw e;
    }

    if (this.ui.renderingMode === "FOUNTAIN") {
      await this.fountain.processResponse(currentResponse);
    }

    let turnComplete = false;
    let iterations = 0;
    const maxIterations = 10 ** 10;
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
      }

      const toolCalls = this.parser.extractToolCalls(currentResponse);

      const thoughtMatch = currentResponse.match(/<thought>([\s\S]*?)<\/thought>/i);
      if (thoughtMatch && thoughtMatch[1]) {
        const thought = thoughtMatch[1].trim();
        this.ui.displayThought(thought);
        logger.sessionLog(thought);
        currentResponse = currentResponse.replace(thoughtMatch[0], "").trim();
      } else {
        const firstCallIndex = currentResponse.search(/<(?:TOOL_CALL|tool_call)\s*>/i);
        if (firstCallIndex > 0) {
          const thought = currentResponse.substring(0, firstCallIndex).trim();
          if (thought) {
            this.ui.displayThought(thought);
            logger.sessionLog(thought);
            currentResponse = currentResponse.substring(firstCallIndex).trim();
          }
        }
      }

      if (toolCalls.length === 0 || toolCalls.every((tc) => tc.error)) {
        turnComplete = true;
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
              }
              throw new UserInterruptException();
            }

            consecutiveErrors = 0;
            const { response, result } = await this.engine.executeToolCall(
              call.data.name,
              call.data.args,
              { id: call.data.id },
            );

            if (result && result.type === "FOUNTAIN_INJECTION") {
              this.ui.displayChatMessage("system", result.content);
              this.assistant.injectMessage("user", result.content);
              const okResponse = this.parser.formatToolResponse("OK", call.data.id, true);
              this.assistant.injectMessage("user", okResponse);
              return;
            }

            if (
              call.data.name === "setNickname" &&
              typeof result === "string" &&
              result.startsWith("*** ")
            ) {
              const [, name] = result.match(/is now known as\s+(.+)$/);
              if (name) this.ui.agentNickname = name;
            }
            toolResults.push(response);
          } else if (call.error) {
            consecutiveErrors += 1;
            toolResults.push(`<TOOL_RESPONSE>ERR: ${call.error}</TOOL_RESPONSE>`);
          }
        }

        if (consecutiveErrors >= 3) {
          turnComplete = true;
          currentResponse = "CRITICAL ERROR: Too many consecutive JSON validation failures. Stop using tools and explain your intent in plain text.";
          break;
        }

        const resultsPayload = this.ui.renderingMode === "FOUNTAIN"
          ? this.fountain.formatToolResults(toolResults)
          : toolResults.join("\n");

        try {
          currentResponse = await this.api.send(resultsPayload, "user");
        } catch (e) {
          if (e instanceof GeminiSafetyError || e instanceof GeminiEmptyResponseError) {
            this.ui.displayError(`Model Error during tool execution: ${e.message}. Your last message has been removed from history.`);
            this.assistant.popLastMessage();
            turnComplete = true;
            break;
          }
          throw e;
        }

        if (this.ui.renderingMode === "FOUNTAIN") {
          await this.fountain.processResponse(currentResponse);
        }
      }
    }

    if (iterations >= maxIterations) this.ui.displayError("Maximum tool iterations reached.");

    const finalResponse = this.parser.cleanResponse(currentResponse);
    if (finalResponse.trim()) {
      this.ui.displayChatMessage(this.ui.agentNickname, finalResponse);
    }
  }
}

export default TurnProcessor;