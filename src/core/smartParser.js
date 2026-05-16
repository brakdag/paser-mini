import AutoCorrector from "./autoCorrector.js";
import validator from "./schemaRegistry.js";

import { TOOL_ALIASES } from "../tools/registry.js";

class SmartToolParser {
  // Optimized regex: limits capture to 10k characters to avoid blocking the main thread
  static TOOL_PATTERN =
    /<(?:TOOL_CALL|tool_call)\s*>([\s\S]{1,10000}?)(?:<\/(?:TOOL_CALL|tool_call)>|$)/gis;

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

    // Resolve alias to canonical name for validation
    if (typeof data.name === "string" && TOOL_ALIASES[data.name]) {
      data.name = TOOL_ALIASES[data.name];
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
    return `<TOOL_RESPONSE>${JSON.stringify({
      id: callId,
      status: success ? "success" : "error",
      data,
    })}</TOOL_RESPONSE>`;
  }

  cleanResponse(text) {
    if (!text) return "";
    return text.replace(/<[^>]+>.*?<\/[^>]+>/gs, "");
  }
}

export default SmartToolParser;
