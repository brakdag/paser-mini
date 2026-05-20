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
      "fs.readFile": (a) => path.basename(a.path || ""),
      "fs.writeFile": (a) => path.basename(a.path || ""),
      "fs.rm": (a) => path.basename(a.path || ""),
      "fs.readdir": (a) => a.path || "",
      "fs.replaceString": (a) => path.basename(a.path || ""),
      "fs.rename": (a) =>
        `${path.basename(a.origin || "")} -> ${path.basename(a.destination || "")}`,
      "fs.copyFile": (a) =>
        `${path.basename(a.origin || "")} -> ${path.basename(a.destination || "")}`,
      "fs.concatFile": (a) => path.basename(a.destination || ""),
      "pyright.analyze": (a) => path.basename(a.path || ""),
      "eslint.lint": (a) => path.basename(a.path || ""),
      "jsdoc.generate": (a) =>
        `Docs for ${path.basename(a.path || ".")} -> ${a.outputDir || "docs/api"}`,
      "child_process.exec": (a) =>
        a.command.substring(0, 50) + (a.command.length > 50 ? "..." : ""),
      "grep.search": (a) => a.query || "",
      "glob.search": (a) => `pattern: ${a.pattern || ""}`,
      "json.validate": (a) => `len: ${a.json_string?.length || 0}`,
      "config.setNickname": (a) => a.newNickname || "",
      "memento.push": (a) => "insight",
      "chatManager.getTokenCount": () => "tokens",
      "git.lsFiles": () => "tree",
      "git.diff": (a) => path.basename(a.path || ""),
      "git.restore": (a) => path.basename(a.path || ""),
      "git.diffAll": () => "all",
      "git.remoteUrl": () => "url",
      "json.getStructure": (a) => path.basename(a.file_path || ""),
      "json.getNode": (a) => path.basename(a.file_path || ""),
      "json.getArrayInfo": (a) => path.basename(a.file_path || ""),
      "json.updateNode": (a) => path.basename(a.file_path || ""),
      "github.listIssues": (a) => a.repo || "",
      "github.createIssue": (a) => a.title || "",
      "github.editIssue": (a) => `#${a.issue_number || ""}`,
      "github.closeIssue": (a) => `#${a.issue_number || ""}`,
      "github.postComment": (a) => `#${a.issue_number || ""}`,
      "system.notify": (a) => a.message?.substring(0, 30) || "",
      "fountain.insertScene": (a) => a.scene || "",
      "jszip.listContents": (a) => path.basename(a.filePath || ""),
      "binary.analyze": (a) =>
        `${a.action || "analysis"} on ${path.basename(a.filePath || "unknown")}`,
      "duckduckgo.search": (a) => a.query || "",
      "elinks.render": (a) => a.url || "",
      "vm.runInContext": () => "sandbox",
    };
  }

  async executeToolCall(name, args, callData) {
    const displayName = name;
    const toolName = name;

    if (this.strictPureMode) {
      return {
        response: this.toolParser.formatToolResponse(
          "ERR: Pure Mode active. Tool execution is strictly disabled.",
          callData.id,
          false,
        ),
        success: false,
      };
    }
    if (!this.toolTracker.recordAttempt(toolName, args)) {
      return {
        response: this.toolParser.formatToolResponse(
          `Tool loop detected: ${toolName} called too many times.`,
          callData.id,
          false,
        ),
        success: false,
      };
    }

    if (toolName === "executeBash" && !this.ui.bashEnabled) {
      return {
        response: this.toolParser.formatToolResponse(
          "ERR: Bash access is disabled for security. Please use /enableBash to activate it.",
          callData.id,
          false,
        ),
        success: false,
      };
    }

    if (!(toolName in this.tools)) {
      return {
        response: this.toolParser.formatToolResponse(
          `Unknown tool: ${toolName}`,
          callData.id,
          false,
        ),
        success: false,
      };
    }

    if (toolName === "runInstance" && this.instanceMode === true) {
      return {
        response: this.toolParser.formatToolResponse(
          "ERR: Recursion disabled.",
          callData.id,
          false,
        ),
        success: false,
      };
    }

    if (toolName === "sh") {
      const result = await this.tools[toolName](args);
      return {
        response: this.toolParser.formatToolResponse(result, callData.id, true),
        result,
        success: true,
      };
    }

    // Safe detail mapping
    let detail = "no details";
    try {
      const mapper = this._detailMappers[toolName] ?? (() => "no details");
      detail = mapper(args);
    } catch (e) {
      detail = "error mapping details";
    }

    this.ui.startToolMonitoring(displayName, detail);

    try {
      const toolFunc = this.tools[toolName];
      const result = await toolFunc(args);

      const isError = typeof result === 'string' && result.startsWith('ERR:');

      if (toolName === "pushMemory") {
        this.ui.displayPanel("Memento Push", result, "info");
      } else if (toolName === "runInstance") {
        this.ui.displayPanel("Instance Test Output", result, "info");
      }

      if (isError) {
        this.toolTracker.recordFailure(toolName);
        this.ui.endToolMonitoring(displayName, false, detail);
        return {
          response: this.toolParser.formatToolResponse(result, callData.id, false),
          result,
          success: false,
        };
      }

      this.toolTracker.recordSuccess(toolName);
      this.ui.endToolMonitoring(displayName, true, detail);

      return {
        response: this.toolParser.formatToolResponse(result, callData.id, true),
        result,
        success: true,
      };
    } catch (e) {
      this.toolTracker.recordFailure(toolName);
      this.ui.endToolMonitoring(displayName, false, detail);
      return {
        response: this.toolParser.formatToolResponse(
          `ERR: ${e.message}`,
          callData.id,
          false,
        ),
        success: false,
      };
    }
  }
}

export default ExecutionEngine;
