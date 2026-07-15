import path from "path";
import ToolAttemptTracker from "./toolTracker.js";

const DEFAULT_MAX_TURNS = 10000;

/**
 * Extracts base path from args.path.
 * @param {object} args Tool arguments.
 * @returns {string} Extracted detail.
 */
const getPathDetail = (args) => args.path ? path.basename(args.path) : "unknown";
/**
 * Extracts base path from args.file_path.
 * @param {object} args Tool arguments.
 * @returns {string} Extracted detail.
 */
const getFilePathDetail = (args) => args.file_path ? path.basename(args.file_path) : "unknown";
/**
 * Extracts issue number from args.issue_number.
 * @param {object} args Tool arguments.
 * @returns {string} Extracted detail.
 */
const getIssueDetail = (args) => args.issue_number ? `#${args.issue_number}` : "issue";
/**
 * Extracts search query from args.query.
 * @param {object} args Tool arguments.
 * @returns {string} Extracted detail.
 */
const getSearchDetail = (args) => args.query || "search";

/**
 * Map of tool names to functions that extract human-readable details for monitoring.
 * @type {{[key: string]: (args: object) => string}}
 */
const TOOL_DETAIL_EXTRACTORS = {
  /**
   * @param {object} args Tool arguments.
   * @returns {string} Extracted detail.
   */
  read: getPathDetail,
  /**
   * @param {object} args Tool arguments.
   * @returns {string} Extracted detail.
   */
  tail: getPathDetail,
  /**
   * @param {object} args Tool arguments.
   * @returns {string} Extracted detail.
   */
  write: getPathDetail,
  /**
   * @param {object} args Tool arguments.
   * @returns {string} Extracted detail.
   */
  remove: getPathDetail,
  /**
   * @param {object} args Tool arguments.
   * @returns {string} Extracted detail.
   */
  sed: getPathDetail,
  /**
   * @param {object} args Tool arguments.
   * @returns {string} Extracted detail.
   */
  replace: getPathDetail,
  /**
   * @param {object} args Tool arguments.
   * @returns {string} Extracted detail.
   */
  analysis: getPathDetail,
  /**
   * @param {object} args Tool arguments.
   * @returns {string} Extracted detail.
   */
  eslint: getPathDetail,
  /**
   * @param {object} args Tool arguments.
   * @returns {string} Extracted detail.
   */
  diff: getPathDetail,
  /**
   * @param {object} args Tool arguments.
   * @returns {string} Extracted detail.
   */
  restore: (args) => args.filepath ? path.basename(args.filepath) : "unknown",
  /**
   * @param {object} args Tool arguments.
   * @returns {string} Extracted detail.
   */
  img: getPathDetail,
  /**
   * @param {object} args Tool arguments.
   * @returns {string} Extracted detail.
   */
  ls: (args) => args.path || "root",
  /**
   * @param {object} args Tool arguments.
   * @returns {string} Extracted detail.
   */
  list: (args) => args.path || "root",
  /**
   * @param {object} args Tool arguments.
   * @returns {string} Extracted detail.
   */
  rename: (args) => args.origin && args.destination ? `${path.basename(args.origin)} -> ${path.basename(args.destination)}` : "unknown",
  /**
   * @param {object} args Tool arguments.
   * @returns {string} Extracted detail.
   */
  copy: (args) => args.origin && args.destination ? `${path.basename(args.origin)} -> ${path.basename(args.destination)}` : "unknown",
  /**
   * @param {object} args Tool arguments.
   * @returns {string} Extracted detail.
   */
  concat: (args) => args.destination ? path.basename(args.destination) : "unknown",
  /**
   * @param {object} args Tool arguments.
   * @returns {string} Extracted detail.
   */
  doc: (args) => args.path ? `Docs: ${path.basename(args.path)}` : "unknown",
  /**
   * @param {object} args Tool arguments.
   * @returns {string} Extracted detail.
   */
  execute: (args) => args.command ? args.command.substring(0, 50) : "bash",
  /**
   * @param {object} args Tool arguments.
   * @returns {string} Extracted detail.
   */
  grep: getSearchDetail,
  /**
   * @param {object} args Tool arguments.
   * @returns {string} Extracted detail.
   */
  search: getSearchDetail,
  /**
   * @param {object} args Tool arguments.
   * @returns {string} Extracted detail.
   */
  glob: (args) => args.pattern || "pattern",
  /**
   * @param {object} args Tool arguments.
   * @returns {string} Extracted detail.
   */
  validate: (args) => args.json_string ? `len: ${args.json_string.length}` : "json",
  /**
   * @param {object} args Tool arguments.
   * @returns {string} Extracted detail.
   */
  nickname: (args) => args.newNickname || "nickname",
  /**
   * @returns {string} Extracted detail.
   */
  push: () => "insight",
  /**
   * @returns {string} Extracted detail.
   */
  token: () => "tokens",
  /**
   * @returns {string} Extracted detail.
   */
  tree: () => "tree",
  /**
   * @returns {string} Extracted detail.
   */
  difference: () => "all",
  /**
   * @returns {string} Extracted detail.
   */
  remote: () => "url",
  /**
   * @returns {string} Extracted detail.
   */
  patch: () => "git patch",
  /**
   * @param {object} args Tool arguments.
   * @returns {string} Extracted detail.
   */
  structure: getFilePathDetail,
  /**
   * @param {object} args Tool arguments.
   * @returns {string} Extracted detail.
   */
  node: getFilePathDetail,
  /**
   * @param {object} args Tool arguments.
   * @returns {string} Extracted detail.
   */
  arrange: getFilePathDetail,
  /**
   * @param {object} args Tool arguments.
   * @returns {string} Extracted detail.
   */
  update: getFilePathDetail,
  /**
   * @param {object} args Tool arguments.
   * @returns {string} Extracted detail.
   */
  create: (args) => args.title || "issue",
  /**
   * @param {object} args Tool arguments.
   * @returns {string} Extracted detail.
   */
  edit: getIssueDetail,
  /**
   * @param {object} args Tool arguments.
   * @returns {string} Extracted detail.
   */
  close: getIssueDetail,
  /**
   * @param {object} args Tool arguments.
   * @returns {string} Extracted detail.
   */
  post: getIssueDetail,
  /**
   * @param {object} args Tool arguments.
   * @returns {string} Extracted detail.
   */
  notify: (args) => args.message ? args.message.substring(0, 30) : "notify",
  /**
   * @param {object} args Tool arguments.
   * @returns {string} Extracted detail.
   */
  scene: (args) => args.scene || "scene",
  /**
   * @param {object} args Tool arguments.
   * @returns {string} Extracted detail.
   */
  jszip: (args) => args.filePath ? path.basename(args.filePath) : "unknown",
  /**
   * @param {object} args Tool arguments.
   * @returns {string} Extracted detail.
   */
  bin: (args) => args.filePath ? path.basename(args.filePath) : "unknown",
  /**
   * @param {object} args Tool arguments.
   * @returns {string} Extracted detail.
   */
  url: (args) => args.url || "url",
  /**
   * @param {object} args Tool arguments.
   * @returns {string} Extracted detail.
   */
  fetch: (args) => args.searchQuery ? `${args.url} (q: ${args.searchQuery})` : args.url || "url",
  /**
   * @returns {string} Extracted detail.
   */
  run: () => "sandbox",
  /**
   * @param {object} args Tool arguments.
   * @returns {string} Extracted detail.
   */
  reset: (args) => args.user_message ? args.user_message.substring(0, 30) : "reset",
  /**
   * @param {object} args Tool arguments.
   * @returns {string} Extracted detail.
   */
  index: (args) => `${args.path || "root"}${args.filter ? ` (${args.filter})` : ""}`,
  /**
   * @param {object} args Tool arguments.
   * @returns {string} Extracted detail.
   */
  load: (args) => args.ids || "ids",
  /**
   * @param {object} args Tool arguments.
   * @returns {string} Extracted detail.
   */
  real: (args) => args.action || "action",
  /**
   * @param {object} args Tool arguments.
   * @returns {string} Extracted detail.
   */
  inspect: (args) => {
    if (args.path) return path.basename(args.path);
    if (args.command) return args.command.substring(0, 50);
    return "inspect";
  }
};


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
    const extractor = TOOL_DETAIL_EXTRACTORS[toolName];
    return extractor ? extractor(args) : "no details";
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