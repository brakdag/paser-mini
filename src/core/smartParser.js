import AutoCorrector from "./autoCorrector.js";
import validator from "./schemaRegistry.js";

class SmartToolParser {
  // Optimized regex: captures tool call payloads of any length
  static TOOL_PATTERN = /‰([\s\S]*?)※/gis;

  constructor() {
    this.validator = validator;
    this.corrector = AutoCorrector;
  }

  parseCall(rawContent) {
    let data;
    try {
      data = JSON.parse(rawContent);
    } catch (e) {
      try {
        data = JSON.parse(this.corrector.fixJson(rawContent));
      } catch (e2) {
        return { data: null, error: "Invalid JSON format." };
      }
    }

    if (!data || typeof data !== "object" || !data.name) {
      return { data: null, error: "Missing 'name' field." };
    }

    if (typeof data.name === "string" && data.name.endsWith("()")) {
      data.name = data.name.slice(0, -2);
    }

    data.args = data.args || {};

    const validation = this.validator.validate(data.name, data.args);
    if (!validation.isValid) {
      return {
        data: null,
        error: `Validation error: ${validation.errors.join("; ")}`,
      };
    }

    return { data, error: null };
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

  formatToolResponse(data, callId = null, success = true) {
    return `Э${JSON.stringify({
      id: callId,
      status: success ? "success" : "error",
      data,
    })}Ч`;
  }

  cleanResponse(text) {
    if (!text) return "";
    return text.replace(/‰[\s\S]*?※|Э[\s\S]*?Ч|<[^>]+>.*?<\/[^>]+>/gs, "");
  }
}

export default SmartToolParser;
