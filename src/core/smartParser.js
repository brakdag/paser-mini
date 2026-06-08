import * as acorn from "acorn";
import fs from "fs";
import path from "path";
import AutoCorrector from "./autoCorrector.js";
import validator from "./schemaRegistry.js";

class SmartToolParser {
  static TOOL_PATTERN = /\u2030([\s\S]*?)\u203b/gis;

  constructor() {
    this.validator = validator;
    this.corrector = AutoCorrector;
    const regPath = path.join(process.cwd(), "src/tools/registry_positional.json");
    this.positionalRegistry = JSON.parse(fs.readFileSync(regPath, "utf8"));
    this.toolMap = Object.fromEntries(this.positionalRegistry.map(t => [t[0], t]));
  }

  parseCall(rawContent) {
    try {
      // Remove escaped quotes that models sometimes add when they think they are in JSON
      const sanitizedContent = rawContent.replace(/\\"/g, '"');
      const ast = acorn.parse(sanitizedContent, { ecmaVersion: 2020 });
      const expr = ast.body[0]?.expression;
      if (!expr || expr.type !== "CallExpression") throw new Error("Not a function call");
      const name = expr.callee.name;
      const args = expr.arguments.map(arg => {
        if (arg.type === "Literal") return arg.value;
        if (arg.type === "ArrayExpression") return arg.elements.map(e => e.value);
        if (arg.type === "ObjectExpression") {
          return Object.fromEntries(arg.properties.map(p => [p.key.name || p.key.value, p.value.value]));
        }
        return null;
      });

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
    return `\u042d${header} ${content}\u0427`;
  }

  cleanResponse(text) {
    if (!text) return "";
    return text.replace(/\u2030[\s\S]*?\u203b|\u042d[\s\S]*?\u0427|<[^>]+>.*?<\/[^>]+>/gs, "");
  }
}

export default SmartToolParser;