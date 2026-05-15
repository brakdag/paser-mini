import { logger } from "./logger.js";

class UserInterruptException extends Error {
  constructor(message = "User interrupted the agent") {
    super(message);
    this.name = "UserInterruptException";
  }
}

const DESTRUCTIVE_TOOLS = [
  "removeFile",
  "writeFile",
  "replaceString",
  "executeBash",
];

export class TurnProcessor {
  async #sendMessageWithRetry(message, role = "user", attempt = 1) {
    const maxRetries = 5000;
    const baseDelay = 1000;
    try {
      return await this.assistant.sendMessage(message, role);
    } catch (error) {
      if (attempt >= maxRetries) throw error;
      const isRetryable =
        !error.response ||
        [429, 500, 502, 503, 504].includes(error.response.status);
      if (!isRetryable) throw error;
      const delay = baseDelay * Math.pow(2, attempt - 1);
      this.ui.displayError(
        `API Error: ${error.message}. Retrying in ${delay}ms... (Attempt ${attempt}/${maxRetries})`,
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
      return this.#sendMessageWithRetry(message, role, attempt + 1);
    }
  }
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

    logger.info("Starting processTurn", { userInput });

    let processedInput = userInput;
    if (this.ui.renderingMode === "FOUNTAIN") {
      const nick =
        userInput.startsWith("* SCENE:") || userInput.startsWith("* ACTION:")
          ? "system"
          : this.ui.userNickname;
      processedInput = this.ui._renderFountain(nick, userInput);
    }

    let currentResponse = await this.#sendMessageWithRetry(processedInput);

    if (this.ui.renderingMode === "FOUNTAIN") {
      const formatted = this.ui._renderFountain(
        this.ui.agentNickname,
        currentResponse,
      );
      await this.assistant.popLastMessage();
      await this.assistant.injectMessage("model", formatted);
    }

    // Guard against null/filtered responses (NVIDIA/Gemini safety filters)
    const isSafetyBlock =
      currentResponse === null || currentResponse === "null";

    if (isSafetyBlock) {
      this.ui.displayError(
        "The model response was filtered by safety guards. Your last message has been removed from history to prevent blocking the conversation. Please rephrase your request.",
      );
      this.assistant.popLastMessage(); // Remove the triggering message to prevent history poisoning
      return;
    }

    let apiRecoveryAttempts = 0;
    const maxApiRecoveries = 20;

    while (
      currentResponse?.startsWith("Error:") &&
      apiRecoveryAttempts < maxApiRecoveries
    ) {
      apiRecoveryAttempts++;
      this.ui.displayError(
        `API Communication Error (Attempt ${apiRecoveryAttempts}/${maxApiRecoveries}): ${currentResponse}`,
      );
      currentResponse = await this.#sendMessageWithRetry(
        `System Error: ${currentResponse}. Please attempt to recover or rephrase your last action.`,
      );
    }

    if (currentResponse?.startsWith("Error:")) {
      this.ui.displayError(
        "Critical API failure after multiple attempts. Halting.",
      );
      return;
    }
    logger.debug("Received response from assistant", {
      responseLength: currentResponse?.length,
    });

    let turnComplete = false;
    let iterations = 0;
    const maxIterations = 10 ** 10;
    let consecutiveErrors = 0;

    while (!turnComplete && iterations < maxIterations) {
      iterations++;
      const repetitionCheck = this.repetitionDetector.addText(currentResponse);
      if (repetitionCheck !== true) {
        this.ui.displayChatMessage(
          "system",
          `-!- [RepetitionDetector] Repetition detected: ${repetitionCheck}`,
        );
        this.ui.displayError("Repetition detected: " + repetitionCheck);
        currentResponse =
          "ERR: Repetition detected. Please rephrase your response.";
      }

      const toolCalls = this.parser.extractToolCalls(currentResponse);

      // UX: Separate reasoning (thought) from action
      // UX: Extract reasoning (thought) regardless of tool calls
      const thoughtMatch = currentResponse.match(
        /<thought>([\s\S]*?)<\/thought>/i,
      );
      if (thoughtMatch && thoughtMatch[1]) {
        const thought = thoughtMatch[1].trim();
        this.ui.displayThought(thought);
        logger.sessionLog(thought);
        // Remove the thought block from the response to avoid double-displaying it as text
        currentResponse = currentResponse.replace(thoughtMatch[0], "").trim();
      } else {
        // Fallback: If no explicit <thought> tags, check if there's text before the first tool call
        const firstCallIndex = currentResponse.search(
          /<(?:TOOL_CALL|tool_call)\s*>/i,
        );
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
        let toolResults = [];
        for (const call of toolCalls) {
          if (call.data) {
            // Zero-Friction Intervention Check
            const isDestructive = DESTRUCTIVE_TOOLS.includes(call.data.name);
            if (this.ui.inputQueue && this.ui.inputQueue.length > 0) {
              if (isDestructive) {
                logger.info("Destructive tool interrupted by user input");
                throw new UserInterruptException();
              }
              // For non-destructive tools, we can choose to interrupt or continue.
              // To be truly responsive, we interrupt any turn if the user speaks.
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

              const okResponse = this.parser.formatToolResponse(
                "OK",
                call.data.id,
                true,
              );
              this.assistant.injectMessage("user", okResponse);

              return;
            }

            if (
              call.data.name === "setNickname" &&
              typeof result === "string" &&
              result.startsWith("*** ")
            ) {
              const match = result.match(/is now known as\s+(.+)$/);
              if (match) {
                this.ui.agentNickname = match[1];
              }
            }
            toolResults.push(response);
          } else if (call.error) {
            consecutiveErrors++;
            toolResults.push(
              `<TOOL_RESPONSE>ERR: ${call.error}</TOOL_RESPONSE>`,
            );
          }
        }

        if (consecutiveErrors >= 3) {
          turnComplete = true;
          currentResponse =
            "CRITICAL ERROR: Too many consecutive JSON validation failures. Stop using tools and explain your intent in plain text.";
          break;
        }
        currentResponse = await this.#sendMessageWithRetry(
          this.ui.renderingMode === "FOUNTAIN"
            ? this.ui._renderFountain("system", toolResults.join("\n"))
            : toolResults.join("\n"),
          "user",
        );

        if (this.ui.renderingMode === "FOUNTAIN") {
          const formatted = this.ui._renderFountain(
            this.ui.agentNickname,
            currentResponse,
          );
          await this.assistant.popLastMessage();
          await this.assistant.injectMessage("model", formatted);
        }

        // Guard against null/filtered responses during tool iterations
        const isSafetyBlock =
          currentResponse === null ||
          currentResponse === "null" ||
          (typeof currentResponse === "string" &&
            (currentResponse.includes("safety block") ||
              currentResponse.includes("blocked by safety filters")));

        if (isSafetyBlock) {
          this.ui.displayError(
            "The model response was filtered by safety guards during tool execution. Your last message has been removed from history. Please rephrase your request.",
          );
          this.assistant.popLastMessage(); // Remove the triggering message to prevent history poisoning
          turnComplete = true;
          break;
        }

        if (currentResponse?.startsWith("Error:")) {
          apiRecoveryAttempts++;
          if (apiRecoveryAttempts < maxApiRecoveries) {
            this.ui.displayError(
              `API Communication Error during tool processing (Attempt ${apiRecoveryAttempts}/${maxApiRecoveries}): ${currentResponse}`,
            );
            currentResponse = await this.#sendMessageWithRetry(
              `System Error: ${currentResponse}. Please attempt to recover or rephrase your last action.`,
            );
          } else {
            this.ui.displayError(
              "Critical API failure during tool processing. Halting.",
            );
            return;
          }
        }
      }
    }

    if (iterations >= maxIterations)
      this.ui.displayError("Maximum tool iterations reached.");

    const cleanedResponse = this.parser.cleanResponse(currentResponse);
    const finalResponse = cleanedResponse;
    if (finalResponse.trim()) {
      this.ui.displayChatMessage(this.ui.agentNickname, finalResponse);
    }
  }
}
