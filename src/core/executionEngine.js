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
      /**
       * @returns {string} The base name of the file being read.
       */
      read: () => args.path ? path.basename(args.path) : "unknown",
      /**
       * @returns {string} The base name of the file being tailed.
       */
      tail: () => args.path ? path.basename(args.path) : "unknown",
      /**
       * @returns {string} The base name of the file being written.
       */
      write: () => args.path ? path.basename(args.path) : "unknown",
      /**
       * @returns {string} The base name of the file being removed.
       */
      remove: () => args.path ? path.basename(args.path) : "unknown",
      /**
       * @returns {string} The base name of the file being replaced.
       */
      replace: () => args.path ? path.basename(args.path) : "unknown",
      /**
       * @returns {string} The base name of the file being analyzed.
       */
      analysis: () => args.path ? path.basename(args.path) : "unknown",
      /**
       * @returns {string} The base name of the file being linted.
       */
      eslint: () => args.path ? path.basename(args.path) : "unknown",
      /**
       * @returns {string} The base name of the file being diffed.
       */
      diff: () => args.path ? path.basename(args.path) : "unknown",
      /**
       * @returns {string} The base name of the file being restored.
       */
      restore: () => args.path ? path.basename(args.path) : "unknown",
      /**
       * @returns {string} The directory path being listed.
       */
      ls: () => args.path || "root",
      /**
       * @returns {string} The directory path being listed.
       */
      list: () => args.path || "root",
      /**
       * @returns {string} The rename operation mapping.
       */
      rename: () => args.origin && args.destination ? `${path.basename(args.origin)} -> ${path.basename(args.destination)}` : "unknown",
      /**
       * @returns {string} The copy operation mapping.
       */
      copy: () => args.origin && args.destination ? `${path.basename(args.origin)} -> ${path.basename(args.destination)}` : "unknown",
      /**
       * @returns {string} The destination file for concatenation.
       */
      concat: () => args.destination ? path.basename(args.destination) : "unknown",
      /**
       * @returns {string} The documentation file path.
       */
      doc: () => args.path ? `Docs: ${path.basename(args.path)}` : "unknown",
      /**
       * @returns {string} The command being executed.
       */
      execute: () => args.command ? args.command.substring(0, 50) : "bash",
      /**
       * @returns {string} The query string for grep.
       */
      grep: () => args.query || "search",
      /**
       * @returns {string} The glob pattern for file search.
       */
      glob: () => args.pattern || "pattern",
      /**
       * @returns {string} The length of the JSON string being validated.
       */
      valide: () => args.json_string ? `len: ${args.json_string.length}` : "json",
      /**
       * @returns {string} The new nickname being set.
       */
      nickname: () => args.newNickname || "nickname",
      /**
       * @returns {string} The insight target.
       */
      push: () => "insight",
      /**
       * @returns {string} The token target.
       */
      token: () => "tokens",
      /**
       * @returns {string} The tree structure target.
       */
      tree: () => "tree",
      /**
       * @returns {string} The difference target.
       */
      difference: () => "all",
      /**
       * @returns {string} The remote URL target.
       */
      remote: () => "url",
      /**
       * @returns {string} The git patch target.
       */
      patch: () => "git patch",
      /**
       * @returns {string} The file path for structure analysis.
       */
      structure: () => args.file_path ? path.basename(args.file_path) : "unknown",
      /**
       * @returns {string} The file path for node analysis.
       */
      node: () => args.file_path ? path.basename(args.file_path) : "unknown",
      /**
       * @returns {string} The file path for arrangement.
       */
      arrange: () => args.file_path ? path.basename(args.file_path) : "unknown",
      /**
       * @returns {string} The file path for update.
       */
      update: () => args.file_path ? path.basename(args.file_path) : "unknown",
      /**
       * @returns {string} The title of the issue being created.
       */
      create: () => args.title || "issue",
      /**
       * @returns {string} The issue number being edited.
       */
      edit: () => args.issue_number ? `#${args.issue_number}` : "issue",
      /**
       * @returns {string} The issue number being closed.
       */
      close: () => args.issue_number ? `#${args.issue_number}` : "issue",
      /**
       * @returns {string} The issue number being posted to.
       */
      post: () => args.issue_number ? `#${args.issue_number}` : "issue",
      /**
       * @returns {string} The notification message snippet.
       */
      notify: () => args.message ? args.message.substring(0, 30) : "notify",
      /**
       * @returns {string} The scene name.
       */
      scene: () => args.scene || "scene",
      /**
       * @returns {string} The zip file path.
       */
      jszip: () => args.filePath ? path.basename(args.filePath) : "zip",
      /**
       * @returns {string} The binary file path.
       */
      bin: () => args.filePath ? path.basename(args.filePath) : "binary",
      /**
       * @returns {string} The web search query.
       */
      search: () => args.query || "web",
      /**
       * @returns {string} The target URL.
       */
      url: () => args.url || "url",
      /**
       * @returns {string} The sandbox environment target.
       */
      run: () => "sandbox",
      /**
       * @returns {string} The image file path.
       */
      img: () => args.path ? path.basename(args.path) : "image",
      /**
       * @returns {string} The reset message snippet.
       */
      reset: () => args.user_message ? args.user_message.substring(0, 30) : "reset",
      /**
       * @returns {string} The action being performed.
       */
      real: () => args.action || "action",
    };

    const extractor = extractors[toolName];
    return extractor ? extractor() : "no details";
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