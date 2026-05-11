import path from 'path';
import { ToolAttemptTracker } from './toolTracker.js';
import { TOOL_ALIASES } from '../tools/registry.js';


export class ExecutionEngine {
  constructor(assistant, tools, toolParser, ui, instanceMode = false, tracker = null, pureMode = false) {
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
      'readFile': (a) => path.basename(a.path || ''),
      'writeFile': (a) => path.basename(a.path || ''),
      'removeFile': (a) => path.basename(a.path || ''),
      'replaceString': (a) => path.basename(a.path || ''),
      'listDir': (a) => a.path || '',
      'createDir': (a) => a.path || '',
      'renamePath': (a) => `${path.basename(a.origin || '')} -> ${path.basename(a.destination || '')}`,
      'pushMemory': (a) => a.key || 'unknown',
      'pullMemory': (a) => a.key || 'unknown',
      'runInstance': (a) => a.target || 'unknown',
      'searchTextGlobal': (a) => `${a.query || ''}`,
      'searchFilesPattern': (a) => `pattern: ${a.pattern || ''}`,
      'analyzeCode': (a) => path.basename(a.path || ''),
      'lintCode': (a) => path.basename(a.path || ''),
      'generateDocs': (a) => `Docs for ${path.basename(a.path || '.')} -> ${a.outputDir || 'docs/api'}`,
      'executeBash': (a) => a.command.substring(0, 50) + (a.command.length > 50 ? '...' : ''),
      'runPython': (a) => path.basename(a.scriptPath || ''),
      'binaryAnalysis': (a) => `${a.action || 'analysis'} on ${path.basename(a.filePath || 'unknown')}`,
    };
  }

  async executeToolCall(name, args, callData) {
    const displayName = name;
    const toolName = TOOL_ALIASES[name] || name;

    if (this.strictPureMode) {
      return {
        response: this.toolParser.formatToolResponse(
          'ERR: Pure Mode active. Tool execution is strictly disabled.',
          callData.id,
          false
        ),
        success: false,
      };
    }
    if (!this.toolTracker.recordAttempt(toolName, args)) {
      return {
        response: this.toolParser.formatToolResponse(
          'Tool loop detected: ' + toolName + ' called too many times.',
          callData.id,
          false
        ),
        success: false,
      };
    }

    if (toolName === 'executeBash' && !this.ui.bashEnabled) {
      return {
        response: this.toolParser.formatToolResponse(
          'ERR: Bash access is disabled for security. Please use /enableBash to activate it.',
          callData.id,
          false
        ),
        success: false,
      };
    }

    if (!(toolName in this.tools)) {
      return {
        response: this.toolParser.formatToolResponse(
          'Unknown tool: ' + toolName,
          callData.id,
          false
        ),
        success: false,
      };
    }

    if (toolName === 'runInstance' && this.instanceMode === true) {
      return {
        response: this.toolParser.formatToolResponse(
          'ERR: Recursion disabled.',
          callData.id,
          false
        ),
        success: false,
      };
    }

    // Safe detail mapping
    let detail = 'no details';
    try {
      const mapper = this._detailMappers[toolName] ?? (() => 'no details');
      detail = mapper(args);
    } catch (e) {
      detail = 'error mapping details';
    }

    this.ui.startToolMonitoring(displayName, detail);

    try {
      const toolFunc = this.tools[toolName];
      const result = await toolFunc(args);

      if (toolName === 'pullMemory') {
        this.ui.displayPanel('Memento Pull', 'Accessing node #' + args.key, 'info');
      } else if (toolName === 'pushMemory') {
        this.ui.displayPanel('Memento Push', result, 'info');
      } else if (toolName === 'runInstance') {
        this.ui.displayPanel('Instance Test Output', result, 'info');
      }

      this.toolTracker.recordSuccess(toolName);
      this.ui.endToolMonitoring(displayName, true, detail);

      return {
        response: this.toolParser.formatToolResponse(
          result,
          callData.id,
          true
        ),
        result: result,
        success: true,
      };
    } catch (e) {
      this.toolTracker.recordFailure(toolName);
      this.ui.endToolMonitoring(displayName, false, detail);
      return {
        response: this.toolParser.formatToolResponse(`ERR: ${e.message}`, callData.id, false),
        success: false,
      };
    }
  }
}