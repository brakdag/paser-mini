
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import AutoCorrector from "./autoCorrector.js";
import validator from "./schemaRegistry.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class SmartToolParser {
  static TOOL_PATTERN = /Ə([\s\S]*?)(?:ə|$)/gis;

  constructor() {
    this.validator = validator;
    this.corrector = AutoCorrector;
    const regPath = path.join(__dirname, "../tools/registry_positional.json");
    this.positionalRegistry = JSON.parse(fs.readFileSync(regPath, "utf8"));
    this.toolMap = Object.fromEntries(this.positionalRegistry.map(t => [t[0], t]));
  }

  _castValue(val) {
    if (!val) return null;
    const trimmed = val.trim();
    if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
      return trimmed.substring(1, trimmed.length - 1);
    }
    if (!isNaN(trimmed) && trimmed !== "") return Number(trimmed);
    if (trimmed === "true") return true;
    if (trimmed === "false") return false;
    if (trimmed === "null") return null;
    try {
      if (trimmed.startsWith("[") && trimmed.endsWith("]")) return JSON.parse(trimmed.replace(/'/g, '"'));
      if (trimmed.startsWith("{") && trimmed.endsWith("}")) return JSON.parse(trimmed.replace(/'/g, '"'));
    } catch { /* empty */ }
    return trimmed;
  }

  parseCall(rawContent) {
    try {
      const match = rawContent.match(/^([a-zA-Z0-9_]+)\s*\((.*)\)$/s);
      if (!match) return { data: null, error: "Not a function call" };

      const name = match[1];
      const argsRaw = match[2].trim();
      const args = [];
      let current = "";
      let depth = 0;
      let inQuote = null;

      for (let i = 0; i < argsRaw.length; i += 1) {
        const char = argsRaw[i];
        if (inQuote) {
          if (char === inQuote && argsRaw[i - 1] !== "\\") inQuote = null;
          current += char;
        } else if (char === '"' || char === "'") {
          inQuote = char;
          current += char;
        } else if (char === "[ " || char === "{") {
          depth++;
          current += char;
        } else if (char === "]" || char === "}") {
          depth--;
          current += char;
        } else if (char === "," && depth === 0) {
          args.push(this._castValue(current.trim()));
          current = "";
        } else {
          current += char;
        }
      }
      if (current.trim()) args.push(this._castValue(current.trim()));

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
    match = SmartToolParser.TOOL_PATTERN.exec(text);
    while (match !== null) {
      const content = match[1].trim();
      const { data, error } = this.parseCall(content);
      results.push({ data, content, error });
      match = SmartToolParser.TOOL_PATTERN.exec(text);
    }
    return results;
  }

  formatToolResponse(context, data) {
    const header = context ? `[${context}]` : "[no details]";
    const content = typeof data === 'object' ? JSON.stringify(data) : data;
    return `ø${header} ${content}ć`;
  }

  cleanResponse(text) {
    if (!text) return "";
    // Tolerant cleaning: removes tool calls even if the closing delimiter is missing
    return text.replace(/Ə[\s\S]*?(?:ə|$)|ø[\s\S]*?ć|<[^>]+>.*?<\/[^>]+>/gs, "");
  }
}

export default SmartToolParser;