import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import * as acorn from "acorn";
import logger from "./logger.js";
import validator from "./schemaRegistry.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OPEN = "\u018f";       // Latin Capital Schwa
const CLOSE = "\u0259";      // Latin Small Schwa

/**
 * SmartToolParser - Parses and executes tool calls from delimited text.
 */
class SmartToolParser {
  /**
   * Initializes the parser, loads positional registry, and binds validator.
   */
  constructor() {
    this.validator = validator;
    const regPath = path.join(__dirname, "../infrastructure/registry_positional.json");
    this.positionalRegistry = JSON.parse(fs.readFileSync(regPath, "utf8"));
    /**
     * @type {{[key: string]: Array}}
     */
    this.toolMap = Object.fromEntries(
      this.positionalRegistry.map((t) => [t[0], t]),
    );
  }

  /**
   * Checks if a tool uses positional arguments.
   * @param {string} name - The tool name.
   * @returns {boolean} True if the tool is positional.
   */
  isPositional(name) {
    return !!this.toolMap[name];
  }

  /**
   * Casts a raw string value to its appropriate JS type (string, number, boolean, null, array, object).
   * @param {string} val - The raw string value.
   * @returns {unknown} The typed value.
   */
  _castValue(val) {
    if (!val) return null;
    const trimmed = val.trim();
    if (
      (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'")) ||
      (trimmed.startsWith("`") && trimmed.endsWith("`"))
    ) {
      return trimmed.substring(1, trimmed.length - 1);
    }
    if (!Number.isNaN(Number(trimmed)) && trimmed !== "") return Number(trimmed);
    if (trimmed === "true") return true;
    if (trimmed === "false") return false;
    if (trimmed === "null") return null;
    try {
      if (trimmed.startsWith("[") && trimmed.endsWith("]"))
        return JSON.parse(trimmed.replace(/'/g, '"'));
      if (trimmed.startsWith("{") && trimmed.endsWith("}"))
        return JSON.parse(trimmed.replace(/'/g, '"'));
    } catch (e) {
      logger.error(`JSON Parse Error in _castValue: ${e.message}`);
    }
    return trimmed;
  }

  /**
   * Evaluates an AST node to extract its raw or typed value.
   * @param {object} node - The AST node.
   * @param {string} rawContent - The original raw content string.
   * @returns {unknown} The evaluated value.
   */
  _evaluateAST(node, rawContent) {
    if (node.type === "Literal") return node.value;
    if (node.type === "TemplateLiteral") {
      let result = "";
      for (let i = 0; i < node.quasis.length; i += 1) {
        result += node.quasis[i].value.cooked;
        if (node.expressions[i]) {
          result += `\${${rawContent.substring(node.expressions[i].start, node.expressions[i].end)}}`;
        }
      }
      return result;
    }
    if (node.type === "ArrayExpression") {
      return node.elements.map((e) => this._evaluateAST(e, rawContent));
    }
    if (node.type === "ObjectExpression") {
      const obj = {};
      node.properties.forEach((prop) => {
        const key = prop.key.type === "Identifier" ? prop.key.name : prop.key.value;
        obj[key] = this._evaluateAST(prop.value, rawContent);
      });
      return obj;
    }
    return this._castValue(rawContent.substring(node.start, node.end));
  }

  /**
   * Parses a single tool call expression into structured data.
   * @param {string} rawContent - The raw expression string (e.g. write("path", "content")).
   * @returns {{data: ?{name: string, args: object}, error: ?string}} Result.
   */
  parseCall(rawContent) {
    try {
      const ast = acorn.parse(rawContent, { ecmaVersion: 2020 });
      if (ast.body.length === 0) return { data: null, error: "Empty call" };
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
      const toolDef = this.toolMap[name];
      if (!toolDef) return { data: null, error: `Unknown tool: ${name}` };
      const schema = toolDef[2];
      let finalArgs = {};
      if (typeof schema === "object" && schema !== null) {
        const keys = Object.keys(schema);
        args.forEach((val, i) => {
          if (keys[i]) finalArgs[keys[i]] = val;
        });
      } else {
        finalArgs = { data: args.join(" ") };
      }
      const validation = this.validator.validate(name, finalArgs);
      if (!validation.isValid)
        return {
          data: null,
          error: `Validation: ${validation.errors.join("; ")}`,
        };
      return { data: { name, args: finalArgs }, error: null };
    } catch (e) {
      return { data: null, error: `Parse error: ${e.message}` };
    }
  }

  /**
   * Finds the closing parenthesis of a tool call, tracking depth and string literals.
   * @param {string} text - The full text to search.
   * @param {number} start - The index to start searching from.
   * @returns {number} The index of the closing parenthesis, or -1 if not found.
   */
  _findCallEnd(text, start) {
    let i = start;
    let inString = null;
    let depth = 0;

    while (i < text.length) {
      const ch = text[i];
      if (inString) {
        if (ch === "\\") {
          i += 2;
        } else {
          if (ch === inString) inString = null;
          i += 1;
        }
      } else if (ch === '"' || ch === "'" || ch === "`") {
        inString = ch;
        i += 1;
      } else if (ch === "(") {
        depth += 1;
        i += 1;
      } else if (ch === ")" && depth > 0) {
        depth -= 1;
        if (depth === 0) return i;
        i += 1;
      } else {
        i += 1;
      }
    }
    return -1;
  }

  /**
   * Extracts all tool calls from a given text block.
   * @param {string} text - The text to parse for tool calls.
   * @returns {Array<{data: unknown, content: string, error: unknown}>} An array of parsed tool calls.
   */
  extractToolCalls(text) {
    const calls = [];
    let pos = 0;
    while (pos < text.length) {
      const openIdx = text.indexOf(OPEN, pos);
      if (openIdx === -1) break;
      const contentStart = openIdx + 1;
      const closeIdx = this._findCallEnd(text, contentStart);
      let content;
      let endIdx;
      if (closeIdx === -1) {
        content = text.substring(contentStart).trim();
        endIdx = text.length;
      } else {
        content = text.substring(contentStart, closeIdx + 1).trim();
        endIdx = closeIdx + 1;
        if (text[endIdx] === CLOSE) {
          endIdx += 1;
        }
      }
      if (content) {
        const { data, error } = this.parseCall(content);
        calls.push({ data, content, error });
      }
      pos = endIdx;
    }
    return calls;
  }

  /**
   * Formats a tool response into a clean string.
   * @param {string} context - The context/header (e.g. file path or tool name).
   * @param {unknown} data - The data to format.
   * @returns {string} The formatted response.
   */
  formatToolResponse(context, data) {
    const header = context ? `[${context}]` : "[no details]";
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
      const closeIdx = this._findCallEnd(text, openIdx + 1);
      if (closeIdx === -1) {
        pos = text.length;
      } else {
        pos = closeIdx + 1;
        if (text[pos] === CLOSE) {
          pos += 1;
        }
      }
    }
    return result;
  }
}

export default SmartToolParser;