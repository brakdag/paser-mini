import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import * as acorn from "acorn";
import AutoCorrector from "./autoCorrector.js";
import validator from "./schemaRegistry.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 *
 */
class SmartToolParser {
  static TOOL_PATTERN = /Ə([\s\S]*?)(?:ə|$)/gis;

  /**
   *
   */
  constructor() {
    this.validator = validator;
    this.corrector = AutoCorrector;
    const regPath = path.join(__dirname, "../tools/registry_positional.json");
    this.positionalRegistry = JSON.parse(fs.readFileSync(regPath, "utf8"));
    /**
     *
     * @param name
     */
    this.isPositional = (name) => !!this.toolMap[name];
    this.toolMap = Object.fromEntries(
      this.positionalRegistry.map((t) => [t[0], t]),
    );
  }

  /**
   *
   * @param val
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
    if (!Number.isNaN(Number(trimmed)) && trimmed !== "")
      return Number(trimmed);
    if (trimmed === "true") return true;
    if (trimmed === "false") return false;
    if (trimmed === "null") return null;
    try {
      if (trimmed.startsWith("[") && trimmed.endsWith("]"))
        return JSON.parse(trimmed.replace(/'/g, '"'));
      if (trimmed.startsWith("{") && trimmed.endsWith("}"))
        return JSON.parse(trimmed.replace(/'/g, '"'));
    } catch {
      /* empty */
    }
    return trimmed;
  }

  /**
   *
   * @param node
   * @param rawContent
   */
  _evaluateAST(node, rawContent) {
    if (node.type === "Literal") return node.value;
    if (node.type === "ArrayExpression") {
      return node.elements.map((e) => this._evaluateAST(e, rawContent));
    }
    if (node.type === "ObjectExpression") {
      const obj = {};
      for (const prop of node.properties) {
        let key = prop.key.type === "Identifier" ? prop.key.name : prop.key.value;
        obj[key] = this._evaluateAST(prop.value, rawContent);
      }
      return obj;
    }
    return this._castValue(rawContent.substring(node.start, node.end));
  }

  /**
   *
   * @param rawContent
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

      const name = callExpr.callee.name;
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
   *
   * @param text
   */
  extractToolCalls(text) {
    const results = [];
    let match;
    SmartToolParser.TOOL_PATTERN.lastIndex = 0;
    match = SmartToolParser.TOOL_PATTERN.exec(text);
    while (match !== null) {
      const content = match[1].trim();
      const { data, error } = this.parseCall(content);
      results.push({ data, content, error });
      match = SmartToolParser.TOOL_PATTERN.exec(text);
    }
    return results;
  }

  /**
   *
   * @param context
   * @param data
   */
  formatToolResponse(context, data) {
    const header = context ? `[${context}]` : "[no details]";
    const content = typeof data === "object" ? JSON.stringify(data) : data;
    return `ø${header} ${content}ć`;
  }

  /**
   *
   * @param text
   */
  cleanResponse(text) {
    if (!text) return "";
    // Tolerant cleaning: removes tool calls even if the closing delimiter is missing
    return text.replace(
      /Ə[\s\S]*?(?:ə|$)|ø[\s\S]*?ć|<[^>]+>.*?<\/[^>]+>/gs,
      "",
    );
  }
}

export default SmartToolParser;
