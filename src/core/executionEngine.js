import { normalizeToolResult, toolResultText } from "./toolResult.js";
import ToolAttemptTracker from "./toolTracker.js";
import getToolDetail from "./toolDetailExtractor.js";

/**
 * ExecutionEngine is responsible for the orchestration of tool calls.
 * It manages tool validation, loop detection, security constraints,
 * and the actual invocation of tool functions, ensuring that results
 * are formatted and tracked correctly.
 */
class ExecutionEngine {
  /**
   * Initializes a new instance of the ExecutionEngine.
   * @param {{[key: string]: (...args: unknown[]) => Promise<unknown>}} tools - A map of available tool functions.
   * @param {object} toolParser - The parser used to handle tool arguments and format responses.
   * @param {object} ui - The UI interface for tool monitoring and user interaction.
   * @param {object} [options] - Execution policy.
   * @param {ToolAttemptTracker|null} [options.tracker] - Tool attempt tracker.
   * @param {boolean} [options.pureMode] - If true, tool execution is disabled.
   */
  constructor(
    tools,
    toolParser,
    ui,
    { tracker = null, pureMode = false } = {},
  ) {
    this.tools = tools;
    this.toolParser = toolParser;
    this.ui = ui;
    this.toolTracker = tracker || new ToolAttemptTracker();
    this.strictPureMode = pureMode;
  }

  /**
   * Validates if a tool call can proceed based on security and configuration.
   * @param {string} name - The name of the tool.
   * @returns {string|null} An error message if invalid, otherwise null.
   */
  _validateToolExecution(name) {
    if (this.strictPureMode) {
      return "Pure Mode active. Tool execution is strictly disabled.";
    }
    if (name === "execute" && !this.ui.bashEnabled) {
      return "Bash access is disabled for security. Please ask the user to run /execute to activate it.";
    }
    if (!Object.hasOwn(this.tools, name) || typeof this.tools[name] !== "function") {
      return `Unknown tool: ${name}`;
    }
    return null;
  }

  /**
   * Executes a specific tool call after performing security and validity checks.
   * @param {string} name - The name of the tool to be executed.
   * @param {object} args - The arguments passed to the tool.
   * @returns {Promise<{response: string, result: unknown, outcome: object, success: boolean, terminate: boolean}>} An object containing the formatted response, the raw result, and the success status.
   */
  async executeToolCall(name, args) {
    let result;
    let success = false;
    let outcome;
    let detail = "no details";
    let monitoringStarted = false;
    let terminate = false;

    try {
      const validationError = this._validateToolExecution(name);
      if (validationError) {
        result = validationError;
      } else if (!this.toolTracker.recordAttempt(name, args)) {
        result = `Tool loop detected: ${name} repetition limit reached (unchanged results or total attempts).`;
        terminate = true;
      } else {
        detail = getToolDetail(name, args);

        monitoringStarted = true;
        this.ui.startToolMonitoring(name, detail);

        const toolFunc = this.tools[name];
        result = this.toolParser.isPositional(name)
          ? await toolFunc(...this.toolParser.buildPositionalArgs(name, args))
          : await toolFunc(args);
        outcome = normalizeToolResult(result);
        success = !outcome.isError;
      }
    } catch (e) {
      if (e.name === "UserInterruptException" || e.name === "AbortError" || e.code === "ERR_CANCELED") throw e;
      result = e.message;
      success = false;
    } finally {
      if (monitoringStarted) {
        this.ui.endToolMonitoring(name, success, detail);
      }
    }

    outcome ||= normalizeToolResult(result, success);

    if (success) {
      this.toolTracker.recordSuccess(name, args, result);
    } else {
      this.toolTracker.recordFailure(name, args);
    }

    return {
      response: this.toolParser.formatToolResponse(detail, toolResultText(outcome), success),
      result,
      outcome,
      success,
      terminate,
    };
  }
}

export default ExecutionEngine;
