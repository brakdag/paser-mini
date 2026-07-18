import { UserInterruptException } from "./exceptions.js";

/**
 * Constant for the special Fountain injection result type.
 * Used by the scene tool to interrupt normal execution flow and inject content directly.
 */
const FOUNTAIN_INJECTION_TYPE = "FOUNTAIN_INJECTION";

/**
 * Constant for the special QR display result type.
 * Used by the qr tool to bypass AI context and draw directly to the user's terminal.
 */
const QR_DISPLAY_TYPE = "QR_DISPLAY";

/**
 * Handles the execution of tool calls and manages their interaction with the system.
 */
class ToolExecutor {
  /**
   * Executes a set of tool calls and handles their results.
   * @param {Array} toolCalls The list of tool calls to execute.
   * @param {object} engine The execution engine.
   * @param {object} ui The UI instance.
   * @param {object} assistant The assistant instance.
   * @param {object} parser The parser instance.
   * @returns {Promise<{results: Array, errorCount: number, terminate: boolean}>} The execution results.
   */
  static async execute(toolCalls, engine, ui, assistant, parser) {
    const toolResults = [];
    let errorCount = 0;

    for (let i = 0; i < toolCalls.length; i += 1) {
      const call = toolCalls[i];
      if (call.data) {
        if (ui.inputQueue && ui.inputQueue.length > 0) {
          throw new UserInterruptException();
        }

        const executionResult = await engine.executeToolCall(
          call.data.name,
          call.data.args,
        );
        const { response, result } = executionResult;

        if (result && result.type === FOUNTAIN_INJECTION_TYPE) {
          ui.displayChatMessage("system", result.content);
          assistant.injectMessage("user", result.content);
          assistant.injectMessage(
            "user",
            parser.formatToolResponse("OK", "OK", true),
          );
          return { results: [], errorCount: 0, terminate: true };
        }

        if (result && result.type === QR_DISPLAY_TYPE) {
          ui.displayRawMessage(result.content);
          toolResults.push({
            response: parser.formatToolResponse("qr", "QR code displayed successfully on user terminal.", true),
            result: null,
          });
        } else {
          toolResults.push({ response, result });
        }
      } else if (call.error) {
        errorCount += 1;
        toolResults.push(`ERR: ${call.error}`);
      }
    }
    return { results: toolResults, errorCount, terminate: false };
  }
}

export default ToolExecutor;