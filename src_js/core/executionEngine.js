import path from 'path';
import { SmartToolParser } from './smartParser.js';
import { ToolAttemptTracker } from './toolTracker.js';

export class ExecutionEngine {
  constructor(assistant, tools, toolParser, ui, instanceMode = false, tracker = null) {
    this.assistant = assistant;
    this.tools = tools;
    this.toolParser = toolParser;
    this.ui = ui;
    this.instanceMode = instanceMode;
    this.toolTracker = tracker || new ToolAttemptTracker();
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
      'renamePath': (a) => path.basename(a.origin || '') + ' -> ' + path.basename(a.destination || ''),
      'pushMemory': (a) => a.key || 'unknown',
      'pullMemory': (a) => a.key || 'unknown',
      'runInstance': (a) => a.target || 'unknown',
      'searchTextGlobal': (a) => "'" + (a.query || '') + "'",
      'searchFilesPattern': (a) => 'pattern: ' + (a.pattern || ''),
      'analyzePyright': (a) => path.basename(a.path || ''),
      'runPython': (a) => path.basename(a.scriptPath || ''),
    };
  }

  async executeToolCall(name, args, callData) {
    if (!this.toolTracker.recordAttempt(name, args)) {
      return {
        response: this.toolParser.formatToolResponse(
          'Tool loop detected: ' + name + ' called too many times.',
          callData.id,
          false
        ),
        success: false,
      };
    }

    if (!(name in this.tools)) {
      return {
        response: this.toolParser.formatToolResponse(
          'Unknown tool: ' + name,
          callData.id,
          false
        ),
        success: false,
      };
    }

    if (name === 'runInstance' && this.instanceMode) {
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
      const mapper = this._detailMappers[name] || (() => 'no details');
      detail = mapper(args);
    } catch (e) {
      detail = 'error mapping details';
    }
    
    this.ui.startToolMonitoring(name, detail);

    try {
      const toolFunc = this.tools[name];
      const result = await toolFunc(args);

      if (name === 'pullMemory') {
        this.ui.displayMessage('\ud83e\udde0 **Memento Pull**: Accessing node #' + args.key);
      } else if (name === 'pushMemory') {
        this.ui.displayMessage('\u270d\ufe0f **Memento Push**: ' + result);
      } else if (name === 'runInstance') {
        this.ui.displayMessage('\ud83d\ude80 **Instance Test Output**\n\n' + '```text\n' + result + '\n```');
      }

      this.toolTracker.recordSuccess(name);
      this.ui.endToolMonitoring(name, true, detail);

      return {
        response: this.toolParser.formatToolResponse(
          result,
          callData.id,
          true
        ),
        success: true,
      };
    } catch (e) {
      this.toolTracker.recordFailure(name);
      this.ui.endToolMonitoring(name, false, detail);

      return {
        response: this.toolParser.formatToolResponse(
          'ERR: ' + e.message,
          callData.id,
          false
        ),
        success: false,
      };
    }
  }
}