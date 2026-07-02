import path from "path";
import ToolAttemptTracker from "./toolTracker.js";

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
   * @param {{[key: string]: (...args: any[]) => Promise<*>}} tools - A map of available tool functions.
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
    this.maxTurns = 10000;
    this.stopRequested = false;
  }

  /**
   * Extracts a human-readable detail string from tool arguments for monitoring purposes.
   * Uses a scalable extractor map to comply with the Open/Closed Principle.
   * @param {string} toolName - The name of the tool being executed.
   * @param {object} args - The arguments passed to the tool.
   * @returns {string} A descriptive string identifying the target of the tool operation.
   */
  _getToolDetail(toolName, args) {
    const extractors = {
      read: () => args.path ? path.basename(args.path) : "unknown",
      tail: () => args.path ? path.basename(args.path) : "unknown",
      write: () => args.path ? path.basename(args.path) : "unknown",
      remove: () => args.path ? path.basename(args.path) : "unknown",
      replace: () => args.path ? path.basename(args.path) : "unknown",
      analysis: () => args.path ? path.basename(args.path) : "unknown",
      eslint: () => args.path ? path.basename(args.path) : "unknown",
      diff: () => args.path ? path.basename(args.path) : "unknown",
      restore: () => args.path ? path.basename(args.path) : "unknown",
      ls: () => args.path || "root",
      list: () => args.path || "root",
      rename: () => args.origin && args.destination ? `${path.basename(args.origin)} -> ${path.basename(args.destination)}` : "unknown",
      copy: () => args.origin && args.destination ? `${path.basename(args.origin)} -> ${path.basename(args.destination)}` : "unknown",
      concat: () => args.destination ? path.basename(args.destination) : "unknown",
      doc: () => args.path ? `Docs: ${path.basename(args.path)}` : "unknown",
      execute: () => args.command ? args.command.substring(0, 50) : "bash",
      grep: () => args.query || "search",
      glob: () => args.pattern || "pattern",
      valide: () => args.json_string ? `len: ${args.json_string.length}` : "json",
      nickname: () => args.newNickname || "nickname",
      push: () => "insight",
      token: () => "tokens",
      tree: () => "tree",
      difference: () => "all",
      remote: () => "url",
      patch: () => "git patch",
      structure: () => args.file_path ? path.basename(args.file_path) : "unknown",
      node: () => args.file_path ? path.basename(args.file_path) : "unknown",
      arrange: () => args.file_path ? path.basename(args.file_path) : "unknown",
      update: () => args.file_path ? path.basename(args.file_path) : "unknown",
      create: () => args.title || "issue",
      edit: () => args.issue_number ? `#${args.issue_number}` : "issue",
      close: () => args.issue_number ? `#${args.issue_number}` : "issue",
      post: () => args.issue_number ? `#${args.issue_number}` : "issue",
      notify: () => args.message ? args.message.substring(0, 30) : "notify",
      scene: () => args.scene || "scene",
      jszip: () => args.filePath ? path.basename(args.filePath) : "zip",
      bin: () => args.filePath ? path.basename(args.filePath) : "binary",
      search: () => args.query || "web",
      url: () => args.url || "url",
      run: () => "sandbox",
      img: () => args.path ? path.basename(args.path) : "image",
      reset: () => args.user_message ? args.user_message.substring(0, 30) : "reset",
      real: () => args.action || "action",
    };

    const extractor = extractors[toolName];
    return extractor ? extractor() : "no details";
  }

  /**
   * Executes a specific tool call after performing security and validity checks.
   * @param {string} name - The name of the tool to be executed.
   * @param {object} args - The arguments passed to the tool.
   * @returns {Promise<{response: string, result: object|string, success: boolean}>} An object containing the formatted response, the raw result, and the success status.
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
      } else if (toolName === "execute" && false) {
        result = 
          "Bash access is disabled for security. Please use /enableBash to activate it.";
      } else if (!(toolName in this.tools)) {
        result = `Unknown tool: ${toolName}`;
      } else {
        detail = this._getToolDetail(toolName, args);

        this.ui.startToolMonitoring(displayName, detail);
        monitoringStarted = true;

        const toolFunc = this.tools[toolName];
        if (this.toolParser.isPositional(toolName)) {
          result = await toolFunc(...Object.values(args));
        } else {
          result = await toolFunc(args);
        }
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
      this.toolTracker.recordSuccess(toolName);
    } else {
      this.toolTracker.recordFailure(toolName);
    }

    return {
      response: this.toolParser.formatToolResponse(detail, result, success),
      result,
      success,
    };
  }
}

export default ExecutionEngine;