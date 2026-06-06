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

    const bn = (a, k = 'path') => path.basename(a[k] || "");

    this._detailMappers = {
      "fs.readFile": (a) => bn(a),
      "fs.writeFile": (a) => bn(a),
      "fs.rm": (a) => bn(a),
      "fs.readdir": (a) => a.path || "",
      "fs.replaceString": (a) => bn(a),
      "fs.rename": (a) => `${bn(a, 'origin')} -> ${bn(a, 'destination')}`,
      "fs.copyFile": (a) => `${bn(a, 'origin')} -> ${bn(a, 'destination')}`,
      "fs.concatFile": (a) => bn(a, 'destination'),
      "pyright.analyze": (a) => bn(a),
      "eslint.lint": (a) => bn(a),
      "jsdoc.generate": (a) => `Docs for ${bn(a, '.')} -> ${a.outputDir || "docs/api"}`,
      "child_process.exec": (a) => a.command.substring(0, 50) + (a.command.length > 50 ? "..." : ""),
      "grep.search": (a) => a.query || "",
      "glob.search": (a) => `pattern: ${a.pattern || ""}`,
      "json.validate": (a) => `len: ${a.json_string?.length || 0}`,
      "config.setNickname": (a) => a.newNickname || "",
      "memento.push": () => "insight",
      "chatManager.getTokenCount": () => "tokens",
      "git.lsFiles": () => "tree",
      "git.diff": (a) => bn(a),
      "git.restore": (a) => bn(a),
      "git.diffAll": () => "all",
      "git.remoteUrl": () => "url",
      "json.getStructure": (a) => bn(a, 'file_path'),
      "json.getNode": (a) => bn(a, 'file_path'),
      "json.getArrayInfo": (a) => bn(a, 'file_path'),
      "json.updateNode": (a) => bn(a, 'file_path'),
      "github.listIssues": (a) => a.repo || "",
      "github.createIssue": (a) => a.title || "",
      "github.editIssue": (a) => `#${a.issue_number || ""}`,
      "github.closeIssue": (a) => `#${a.issue_number || ""}`,
      "github.postComment": (a) => `#${a.issue_number || ""}`,
      "system.notify": (a) => a.message?.substring(0, 30) || "",
      "fountain.insertScene": (a) => a.scene || "",
      "jszip.listContents": (a) => bn(a, 'filePath'),
      "binary.analyze": (a) => `${a.action || "analysis"} on ${bn(a, 'filePath')}`,
      "duckduckgo.search": (a) => a.query || "",
      "elinks.render": (a) => a.url || "",
      "vm.runInContext": () => "sandbox",
      "seeImage": (a) => bn(a),
      "system.reset": (a) => a.user_message?.substring(0, 30) || "no message",
      "realAction": (a) => a.action || "no action",
    };
  }

  async executeToolCall(name, args, callData) {
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
      } else if (toolName === "executeBash" && !this.ui.bashEnabled) {
        result = "ERR: Bash access is disabled for security. Please use /enableBash to activate it.";
      } else if (!(toolName in this.tools)) {
        result = `Unknown tool: ${toolName}`;
      } else if (toolName === "runInstance" && this.instanceMode === true) {
        result = "ERR: Recursion disabled.";
      } else {
        try {
          const mapper = this._detailMappers[toolName] ?? (() => "no details");
          detail = mapper(args);
        } catch (e) {
          detail = "error mapping details";
        }

        this.ui.startToolMonitoring(displayName, detail);
        monitoringStarted = true;

        const toolFunc = this.tools[toolName];
        result = await toolFunc(args);
        success = typeof result === 'string' ? !result.startsWith('ERR:') : true;

        if (toolName === "pushMemory") {
          this.ui.displayPanel("Memento Push", result, "info");
        } else if (toolName === "runInstance") {
          this.ui.displayPanel("Instance Test Output", result, "info");
        }
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
      response: this.toolParser.formatToolResponse(result, callData.id, success),
      result,
      success
    };
  }
}

export default ExecutionEngine;
