import * as acorn from "acorn";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import AutoCorrector from "./autoCorrector.js";
import validator from "./schemaRegistry.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class SmartToolParser {
  static TOOL_PATTERN = /<\|tool_call>([\s\S]*?)(?:<tool_call\|>|$)/gis;

  constructor() {
    this.validator = validator;
    this.corrector = AutoCorrector;
    const regPath = path.join(__dirname, "../tools/registry_positional.json");
    this.positionalRegistry = JSON.parse(fs.readFileSync(regPath, "utf8"));
    this.toolMap = Object.fromEntries(this.positionalRegistry.map(t => [t[0], t]));
  }

  parseCall(rawContent) {
    try {
      const ast = acorn.parse(rawContent, { ecmaVersion: 2020 });
      const expr = ast.body[0]?.expression;
      if (!expr || expr.type !== "CallExpression") throw new Error("Not a function call");
      
      const name = expr.callee.name;
      
      const resolveValue = (node) => {
        if (!node) return null;
        if (node.type === "Literal") return node.value;
        if (node.type === "TemplateLiteral") {
          return node.quasis.map(q => q.value.cooked).join("");
        }
        if (node.type === "ArrayExpression") return node.elements.map(resolveValue);
        if (node.type === "ObjectExpression") {
          return Object.fromEntries(node.properties.map(p => [
            p.key.name || p.key.value,
            resolveValue(p.value)
          ]));
        }
        return null;
      };

      const args = expr.arguments.map(resolveValue);

      const toolDef = this.toolMap[name];
      if (!toolDef) return { data: null, error: `Unknown tool: ${name}` };
      const schema = toolDef[2];
      let finalArgs = {};
      if (typeof schema === "object" && schema !== null) {
        const keys = Object.keys(schema);
        args.forEach((val, i) => { if (keys[i]) finalArgs[keys[i]] = val; });
      } else {
        finalArgs = { data: args.join(" ") };
      }

      const validation = this.validator.validate(name, finalArgs);
      if (!validation.isValid) return { data: null, error: `Validation: ${validation.errors.join("; ")}` };
      return { data: { name, args: finalArgs }, error: null };
    } catch (e) {
      return { data: null, error: `Parse error: ${e.message}` };
    }
  }

  extractToolCalls(text) {
    const results = [];
    let match;
    SmartToolParser.TOOL_PATTERN.lastIndex = 0;
    while ((match = SmartToolParser.TOOL_PATTERN.exec(text)) !== null) {
      const content = match[1].trim();
      const { data, error } = this.parseCall(content);
      results.push({ data, content, error });
    }
    return results;
  }

  formatToolResponse(context, data, success = true) {
    const header = context ? `[${context}]` : "[no details]";
    const content = typeof data === 'object' ? JSON.stringify(data) : data;
    return `<|tool_response>${header} ${content}<tool_response|>`;
  }

  cleanResponse(text) {
    if (!text) return "";
    // Tolerant cleaning: removes tool calls even if the closing delimiter is missing
    return text.replace(/<\|tool_call>[\s\S]*?(?:<tool_call\|>|$)|<\|tool_response>[\s\S]*?<tool_response\|>|<[^>]+>.*?<\/[^>]+>/gs, "");
  }
}

export default SmartToolParser;