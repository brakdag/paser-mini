import { AutoCorrector } from './autoCorrector.js';
import validator from './schemaRegistry.js';

export class SmartToolParser {
  static TOOL_PATTERN = /<(?:TOOL_CALL|tool_call)\s*>(.*?)(?:<\/(?:TOOL_CALL|tool_call)>|$)/gis;

  constructor() {
    this.validator = validator;
    this.corrector = AutoCorrector;
  }

  /**
   * Intenta parsear y validar una llamada a herramienta
   * @param {string} rawContent 
   * @returns {{data: any, error: string|null}}
   */
  parseCall(rawContent) {
    let data;
    try {
      data = JSON.parse(rawContent);
    } catch (e) {
      // Intento de corrección automática
      try {
        data = JSON.parse(this.corrector.fixJson(rawContent));
      } catch (e2) {
        return { data: null, error: 'Invalid JSON format.' };
      }
    }

    if (!data || typeof data !== 'object' || !data.name) {
      return { data: null, error: "Missing 'name' field." };
    }

    // Sanitizar nombre de la herramienta (quitar '()' si la IA los añadió)
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

  /**
   * Extrae todas las llamadas a herramientas de un texto
   * @param {string} text 
   * @returns {Array<{data: any, content: string, error: string|null}>}
   */
  extractToolCalls(text) {
    const results = [];
    let match;

    while ((match = this.TOOL_PATTERN.exec(text)) !== null) {
      const content = match[1].trim();
      const { data, error } = this.parseCall(content);
      results.push({ data, content, error });
    }

    return results;
  }

  /**
   * Formatea la respuesta de una herramienta para la IA
   */
  static formatToolResponse(data, callId = null, success = true) {
    return `<TOOL_RESPONSE>${JSON.stringify({
      id: callId,
      status: success ? 'success' : 'error',
      data: data
    })}</TOOL_RESPONSE>`;
  }

  /**
   * Limpia las etiquetas de respuesta del texto
   */
  static cleanResponse(text) {
    if (!text) return '';
    return text.replace(/<[^>]+>.*?<\/[^>]+>/gs, '');
  }
}