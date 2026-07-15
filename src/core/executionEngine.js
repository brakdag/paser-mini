import ToolAttemptTracker from "./toolTracker.js";
import getToolDetail from "./toolDetailExtractor.js";

const DEFAULT_MAX_TURNS = 10000;

/**
 * ExecutionEngine is responsible for the orchestration of tool calls.
 * It manages tool validation, loop detection, security constraints,
 * and the actual invocation of tool functions, ensuring that results
 * are formatted and tracked correctly.
 */
class ExecutionEngine {
  /**
   * Initializes a new instance of the ExecutionEngine.
   * @param {object} assistant - The assistant instance managing the conversation.
   * @param {{[key: string]: (...args: unknown[]) => Promise<unknown>}} tools - A map of available tool functions.
   * @param {object} toolParser - The parser used to handle tool arguments and format responses.
   * @param {object} ui - The UI interface for tool monitoring and user interaction.
   * @param {boolean} [instanceMode] - Whether the engine is running in instance mode.
   * @param {ToolAttemptTracker|null} [tracker] - An optional tracker for tool attempts.
   * @param {boolean} [pureMode] - If true, tool execution is strictly disabled.
   */
  constructor(
    assistant,
    tools,
    toolParser,
    ui,
    instanceMode = false,
    tracker = null,
    pureMode = false,
  ) {
    this.assistant = assistant;
    this.tools = tools;
    this.toolParser = toolParser;
    this.ui = ui;
    this.instanceMode = instanceMode;
    this.toolTracker = tracker || new ToolAttemptTracker();
    this.strictPureMode = pureMode || false;
    this.turnCount = 0;
    this.maxTurns = DEFAULT_MAX_TURNS;
    this.stopRequested = false;
  }

  /**
   * Extracts a human-readable detail string from tool arguments for monitoring purposes.
   * @param {string} toolName - The name of the tool being executed.
   * @param {object} args - The arguments passed to the tool.
   * @returns {string} A descriptive string identifying the target of the tool operation.
   */
  _getToolDetail(toolName, args) {
    return getToolDetail(toolName, args);
  }

  /**
   * Executes a specific tool call after performing security and validity checks.
   * @param {string} name - The name of the tool to be executed.
   * @param {object} args - The arguments passed to the tool.
   * @returns {Promise<{response: string, result: unknown, success: boolean}>} An object containing the formatted response, the raw result, and the success status.
   */
  async executeToolCall(name, args) {
    const displayName = name;
    const toolName = name;
    let result;
    let success = false;
    let detail = "no details";
    let monitoringStarted = false;

    try {
      if (this.strictPureMode) {
        result = "Pure Mode active. Tool execution is strictly disabled.";
      } else if (!this.toolTracker.recordAttempt(toolName, args)) {
        result = `Tool loop detected: ${toolName} called too many times.`;
      } else if (toolName === "execute" && !this.ui.bashEnabled) {
        result = "Bash access is disabled for security. Please ask the user to run /execute to activate it.";
      } else if (!(toolName in this.tools)) {
        result = `Unknown tool: ${toolName}`;
      } else {
        detail = this._getToolDetail(toolName, args);

        this.ui.startToolMonitoring(displayName, detail);
        monitoringStarted = true;

        const toolFunc = this.tools[toolName];
        result = this.toolParser.isPositional(toolName)
          ? await toolFunc(...Object.values(args))
          : await toolFunc(args);
        success = true;
      }
    } catch (e) {
      result = e.message;
      success = false;
    }

    if (monitoringStarted) {
      this.ui.endToolMonitoring(displayName, success, detail);
    }

    if (success) {
      this.toolTracker.recordSuccess(toolName, args);
    } else {
      this.toolTracker.recordFailure(toolName, args);
    }

    return {
      response: this.toolParser.formatToolResponse(detail, result, success),
      result,
      success,
    };
  }
}

export default ExecutionEngine;
