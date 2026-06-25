import path from "path";
import ToolAttemptTracker from "./toolTracker.js";

class ExecutionEngine {
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

    this._detailMappers = {
      read: (a) => (a.path ? path.basename(a.path) : "unknown"),
      write: (a) => (a.path ? path.basename(a.path) : "unknown"),
      remove: (a) => (a.path ? path.basename(a.path) : "unknown"),
      ls: (a) => a.path || "root",
      replace: (a) => (a.path ? path.basename(a.path) : "unknown"),
      rename: (a) =>
        a.origin && a.destination
          ? `${path.basename(a.origin)} -> ${path.basename(a.destination)}`
          : "unknown",
      copy: (a) =>
        a.origin && a.destination
          ? `${path.basename(a.origin)} -> ${path.basename(a.destination)}`
          : "unknown",
      concat: (a) => (a.destination ? path.basename(a.destination) : "unknown"),
      analysis: (a) => (a.path ? path.basename(a.path) : "unknown"),
      eslint: (a) => (a.path ? path.basename(a.path) : "unknown"),
      doc: (a) => (a.path ? `Docs: ${path.basename(a.path)}` : "unknown"),
      execute: (a) => (a.command ? a.command.substring(0, 50) : "bash"),
      grep: (a) => a.query || "search",
      glob: (a) => a.pattern || "pattern",
      valide: (a) => (a.json_string ? `len: ${a.json_string.length}` : "json"),
      nickname: (a) => a.newNickname || "nickname",
      push: () => "insight",
      token: () => "tokens",
      tree: () => "tree",
      diff: (a) => (a.path ? path.basename(a.path) : "unknown"),
      restore: (a) => (a.path ? path.basename(a.path) : "unknown"),
      difference: () => "all",
      remote: () => "url",
      patch: () => "git patch",
      structure: (a) => (a.file_path ? path.basename(a.file_path) : "unknown"),
      node: (a) => (a.file_path ? path.basename(a.file_path) : "unknown"),
      arrange: (a) => (a.file_path ? path.basename(a.file_path) : "unknown"),
      update: (a) => (a.file_path ? path.basename(a.file_path) : "unknown"),
      list: (a) => a.path || "root",
      create: (a) => a.title || "issue",
      edit: (a) => (a.issue_number ? `#${a.issue_number}` : "issue"),
      close: (a) => (a.issue_number ? `#${a.issue_number}` : "issue"),
      post: (a) => (a.issue_number ? `#${a.issue_number}` : "issue"),
      notify: (a) => (a.message ? a.message.substring(0, 30) : "notify"),
      scene: (a) => a.scene || "scene",
      jszip: (a) => (a.filePath ? path.basename(a.filePath) : "zip"),
      bin: (a) => (a.filePath ? path.basename(a.filePath) : "binary"),
      search: (a) => a.query || "web",
      url: (a) => a.url || "url",
      run: () => "sandbox",
      img: (a) => (a.path ? path.basename(a.path) : "image"),
      reset: (a) =>
        a.user_message ? a.user_message.substring(0, 30) : "reset",
      real: (a) => a.action || "action",
    };
  }

  async executeToolCall(name, args) {
    const displayName = name;
    const toolName = name;
    let result;
    let success = false;
    let detail = "no details";
    let monitoringStarted = false;

    try {
      if (this.strictPureMode) {
        result = "ERR: Pure Mode active. Tool execution is strictly disabled.";
      } else if (!this.toolTracker.recordAttempt(toolName, args)) {
        result = `Tool loop detected: ${toolName} called too many times.`;
      } else if (toolName === "execute" && !this.ui.bashEnabled) {
        result =
          "ERR: Bash access is disabled for security. Please use /enableBash to activate it.";
      } else if (!(toolName in this.tools)) {
        result = `Unknown tool: ${toolName}`;
      } else {
        try {
          const mapper = this._detailMappers[toolName] ?? (() => "no details");
          detail = mapper(args);
        } catch {
          detail = "error mapping details";
        }

        this.ui.startToolMonitoring(displayName, detail);
        monitoringStarted = true;

        const toolFunc = this.tools[toolName];
        if (this.toolParser.isPositional(toolName)) {
          result = await toolFunc(...Object.values(args));
        } else {
          result = await toolFunc(args);
        }
        success =
          typeof result === "string" ? !result.startsWith("ERR:") : true;
      }
    } catch (e) {
      result = `ERR: ${e.message}`;
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
