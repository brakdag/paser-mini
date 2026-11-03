import * as acorn from "acorn";
import validator from "./schemaRegistry.js";
import mcpManager from "../infrastructure/McpManager.js";

import TOOL_DEFINITIONS from "../infrastructure/toolDefinitions.js";

const OPEN = "\u018f";       // Latin Capital Schwa
const CLOSE = "\u0259";      // Latin Small Schwa

/**
 * SmartToolParser - Parses and executes tool calls from delimited text.
 */
class SmartToolParser {
  /**
   * Initializes the parser from the shared tool contracts and validator.
   */
  constructor() {
    this.validator = validator;
    this.toolMap = TOOL_DEFINITIONS;
  }

  /**
   * Checks if a tool uses positional arguments.
   * @param {string} name - The tool name.
   * @returns {boolean} True if the tool is positional.
   */
  isPositional(name) {
    return Object.hasOwn(this.toolMap, name);
  }

  /**
   * Builds the positional argument list for a tool from its declared key
   * order, preserving holes for omitted optional parameters. Without this,
   * invoking with Object.values() would shift every later argument when an
   * optional middle parameter is absent.
   * @param {string} name - The tool name.
   * @param {object} args - The validated arguments keyed by parameter name.
   * @returns {Array<unknown>} The arguments in declared positional order.
   */
  buildPositionalArgs(name, args) {
    const toolDef = Object.hasOwn(this.toolMap, name) ? this.toolMap[name] : null;
    if (!toolDef) return Object.values(args);

    const keys = toolDef.parameters;
    let lastProvided = -1;
    keys.forEach((key, index) => {
      if (Object.hasOwn(args, key)) lastProvided = index;
    });

    const positional = [];
    for (let i = 0; i <= lastProvided; i += 1) {
      positional.push(Object.hasOwn(args, keys[i]) ? args[keys[i]] : undefined);
    }
    return positional;
  }

  /**
   * Reads literal arguments without executing JavaScript expressions.
   * Bare names and dotted names remain strings for compatibility with paths.
   * @param {object} node - Argument syntax node.
   * @param {string} rawContent - Original call source.
   * @returns {unknown} Literal argument value.
   */
  _evaluateAST(node, rawContent) {
    if (!node) throw new Error("Unsupported array hole; use undefined explicitly");
    if (node.type === "Literal" && !node.regex && !node.bigint) return node.value;
    if (node.type === "Identifier") {
      return node.name === "undefined" ? undefined : node.name;
    }
    if (node.type === "MemberExpression" && !node.computed && !node.optional) {
      let current = node;
      while (current.type === "MemberExpression" && !current.computed && !current.optional) {
        if (current.property.type !== "Identifier") throw new Error("Unsupported property name");
        current = current.object;
      }
      if (current.type === "Identifier") return rawContent.slice(node.start, node.end);
    }
    if (node.type === "UnaryExpression" && ["+", "-"].includes(node.operator) &&
        node.argument.type === "Literal" && typeof node.argument.value === "number") {
      return node.operator === "-" ? -node.argument.value : node.argument.value;
    }
    if (node.type === "TemplateLiteral" && node.expressions.length === 0) {
      return node.quasis[0].value.cooked;
    }
    if (node.type === "ArrayExpression") {
      return node.elements.map((element) => this._evaluateAST(element, rawContent));
    }
    if (node.type === "ObjectExpression") {
      const entries = node.properties.map((property) => {
        if (property.type !== "Property" || property.computed || property.method ||
            property.shorthand || property.kind !== "init" ||
            !["Identifier", "Literal"].includes(property.key.type)) {
          throw new Error("Unsupported object property");
        }
        const key = property.key.type === "Identifier" ? property.key.name : property.key.value;
        return [key, this._evaluateAST(property.value, rawContent)];
      });
      return Object.fromEntries(entries);
    }
    throw new Error(`Unsupported argument expression: ${node.type}`);
  }

  /**
   * Parses a single tool call expression into structured data.
   * @param {string} rawContent - The raw expression string (e.g. write("path", "content")).
   * @returns {{data: ?{name: string, args: object}, error: ?string}} Result.
   */
  parseCall(rawContent) {
    try {
      if (/[Əə]/.test(rawContent)) throw new Error("Schwa is reserved for tool call markers");
      const ast = acorn.parse(rawContent, { ecmaVersion: 2020 });
      if (ast.body.length === 0) return { data: null, error: "Empty call" };
      if (ast.body.length > 1) {
        return {
          data: null,
          error: "Parse error: expected a single tool call expression",
        };
      }
      const stmt = ast.body[0];
      if (
        stmt.type !== "ExpressionStatement" ||
        stmt.expression.type !== "CallExpression"
      ) {
        return { data: null, error: "Not a function call" };
      }
      const callExpr = stmt.expression;
      if (callExpr.callee.type !== "Identifier") {
        return { data: null, error: "Invalid function name" };
      }
      const { name } = callExpr.callee;
      const args = callExpr.arguments.map((arg) =>
        this._evaluateAST(arg, rawContent),
      );
      const toolDef = Object.hasOwn(this.toolMap, name) ? this.toolMap[name] : null;
      const mcpSchemas = mcpManager.getSchemas();
      const mcpSchema = Object.hasOwn(mcpSchemas, name) ? mcpSchemas[name] : null;
      
      if (!toolDef && !mcpSchema) {
        return { data: null, error: `Unknown tool: ${name}` };
      }
      
      const schema = toolDef ? Object.fromEntries(toolDef.parameters.map((key) => [key, true])) : mcpSchema;
      let finalArgs = {};
      if (typeof schema === "object" && schema !== null) {
        const keySource = mcpSchema ? (mcpSchema.properties || schema) : schema;
        const keys = Object.keys(keySource);
        if (args.length > keys.length) {
          return {
            data: null,
            error:
              `Parse error: ${name} accepts at most ${keys.length} arguments, got ${args.length}`,
          };
        }
        args.forEach((val, i) => {
          if (keys[i]) finalArgs[keys[i]] = val;
        });
      } else {
        finalArgs = { data: args.join(" ") };
      }
      // Bypass local Zod validation for MCP tools; the remote server will validate.
      if (mcpSchema) {
        return { data: { name, args: finalArgs }, error: null };
      }

      const validation = this.validator.validate(name, finalArgs);
      if (!validation.isValid)
        return {
          data: null,
          error: `Validation: ${validation.errors.join("; ")}`,
        };

      return { data: { name, args: validation.correctedArgs }, error: null };
    } catch (e) {
      return { data: null, error: `Parse error: ${e.message}` };
    }
  }

  /**
   * Reads one call after its opening marker. Schwa is reserved everywhere in
   * call source, so the next marker always bounds this call, even inside quotes.
   * The expression's closing parenthesis ends a call without a closing marker.
   * @param {string} text - Response source.
   * @param {number} start - First character after the opening marker.
   * @returns {{end: number, content: string, data: unknown, error: unknown}} Parsed call and boundary.
   */
  _readToolCall(text, start) {
    const nextOpen = text.indexOf(OPEN, start);
    const nextClose = text.indexOf(CLOSE, start);
    const limit = Math.min(
      nextOpen === -1 ? text.length : nextOpen,
      nextClose === -1 ? text.length : nextClose,
    );
    const closed = text[limit] === CLOSE;
    const source = text.slice(start, limit);
    let end = closed ? limit + 1 : limit;
    let content = source.trim();
    if (!closed) {
      try {
        const expression = acorn.parseExpressionAt(source, 0, { ecmaVersion: 2020 });
        const suffix = source.slice(expression.end).trimStart();
        // A second statement or unmatched closing syntax belongs to the same
        // invalid call; ordinary prose remains visible after a complete call.
        const hasExtraCode = /^[;)}\]]/.test(suffix) || /^[\p{ID_Start}$_][\p{ID_Continue}$]*\s*\(/u.test(suffix);
        if (!hasExtraCode) {
          content = source.slice(0, expression.end).trim();
          end = start + expression.end;
        }
      } catch {
        // Pass the complete incomplete/invalid segment to the ordinary parser.
      }
    }
    return { ...this.parseCall(content), content, end };
  }

  /**
   * Extracts calls introduced by schwa; the closing schwa remains optional.
   * @param {string} text - Model response.
   * @returns {Array<{data: unknown, content: string, error: unknown}>} Calls or errors.
   */
  extractToolCalls(text) {
    const calls = [];
    let pos = 0;
    while (pos < text.length) {
      const openIdx = text.indexOf(OPEN, pos);
      if (openIdx === -1) break;
      const { end, ...call } = this._readToolCall(text, openIdx + 1);
      calls.push(call);
      pos = end;
    }
    return calls;
  }

  /**
   * Formats a tool response into a clean string.
   * @param {string} context - The context/header (e.g. file path or tool name).
   * @param {unknown} data - The data to format.
   * @param {boolean} success - Whether the tool execution was successful.
   * @returns {string} The formatted response.
   */
  formatToolResponse(context, data, success = true) {
    const status = success ? "✓" : "✗";
    const header = context ? `[${context}] ${status}` : `[no details] ${status}`;
    const content = typeof data === "object" ? JSON.stringify(data, null, 2) : data;
    return `${header} ${content}`;
  }

  /**
   * Removes tool call delimiters from text, returning only clean content.
   * @param {string} text - The text to clean.
   * @returns {string} The cleaned text.
   */
  cleanResponse(text) {
    if (!text) return "";
    let result = "";
    let pos = 0;
    while (pos < text.length) {
      const openIdx = text.indexOf(OPEN, pos);
      if (openIdx === -1) {
        result += text.substring(pos);
        break;
      }
      result += text.substring(pos, openIdx);
      const { end } = this._readToolCall(text, openIdx + 1);
      pos = end;
    }
    return result;
  }
}

export default SmartToolParser;
