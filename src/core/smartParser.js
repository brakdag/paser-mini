import { AutoCorrector } from './autoCorrector.js';
import validator from './schemaRegistry.js';

export class SmartToolParser {
  // Regex optimizada: limita la captura a 10k caracteres para evitar el bloqueo del hilo principal
  static TOOL_PATTERN = /<(?:TOOL_CALL|tool_call)\s*>([\s\S]{1,10000}?)(?:<\/(?:TOOL_CALL|tool_call)>|$)/gis;

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
        return { data: null, error: 'Invalid JSON format.' };
      }
    }

    if (!data || typeof data !== 'object' || !data.name) {
      return { data: null, error: "Missing 'name' field." };
    }

    if (typeof data.name === 'string' && data.name.endsWith('()')) {
      data.name = data.name.slice(0, -2);
    }

    data.args = data.args || {};

    const validation = this.validator.validate(data.name, data.args);
    if (!validation.isValid) {
      return { data: null, error: 'Validation error: ' + validation.errors.join('; ') };
    }

    return { data, error: null };
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

  formatToolResponse(data, callId = null, success = true) {
    return `<TOOL_RESPONSE>${JSON.stringify({
      id: callId,
      status: success ? 'success' : 'error',
      data: data
    })}</TOOL_RESPONSE>`;
  }

  cleanResponse(text) {
    if (!text) return '';
    return text.replace(/<[^>]+>.*?<\/[^>]+>/gs, '');
  }
}