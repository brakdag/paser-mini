import { toolResultsContent } from "./toolResult.js";
import TurnLimitError from "./exceptions/TurnLimitError.js";
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
   * @param {import("./turnControl.js").default} [control] The active turn budget.
   * @returns {Promise<{results: Array, errorCount: number, executionErrorCount: number, terminate: boolean}>} The execution results.
   */
  static async execute(toolCalls, engine, ui, assistant, parser, control) {
    const toolResults = [];
    let errorCount = 0;
    let executionErrorCount = 0;

    for (let i = 0; i < toolCalls.length; i += 1) {
      control?.beforeAction();
      if (ui.inputQueue?.length) throw new UserInterruptException();
      const call = toolCalls[i];
      if (call.data) {
        const executionResult = await engine.executeToolCall(
          call.data.name,
          call.data.args,
        );
        const { response, result, outcome, success, terminate } = executionResult;
        const action = outcome?.action || (!outcome && result);
        control?.check();
        if (terminate) throw new TurnLimitError(String(result));
        if (success === false) executionErrorCount += 1;
        control?.recordResult(success !== false);

        if (success !== false && action && action.type === FOUNTAIN_INJECTION_TYPE) {
          if (toolResults.length) assistant.injectMessage("user", toolResultsContent(toolResults));
          ui.displayChatMessage("system", action.content);
          assistant.injectMessage("user", action.content);
          assistant.injectMessage(
            "user",
            parser.formatToolResponse("OK", "OK", true),
          );
          return { results: [], errorCount: 0, executionErrorCount: 0, terminate: true };
        }

        if (success !== false && action && action.type === QR_DISPLAY_TYPE) {
          ui.displayRawMessage(action.content);
          toolResults.push({
            response: parser.formatToolResponse("qr", "QR code displayed successfully on user terminal.", true),
            result: null,
            success,
          });
        } else {
          toolResults.push({ name: call.data.name, response, result, outcome, success });
        }
      } else if (call.error) {
        errorCount += 1;
        toolResults.push(`ERR: ${call.error}`);
        control?.recordResult(false);
      }
    }
    return { results: toolResults, errorCount, executionErrorCount, terminate: false };
  }
}

export default ToolExecutor;