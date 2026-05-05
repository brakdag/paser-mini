export class ValidationResult {
  constructor(isValid, errors = [], correctedArgs = null) {
    this.isValid = isValid;
    this.errors = errors;
    this.correctedArgs = correctedArgs;
  }
}

export class SchemaValidator {
  constructor() {
    this.schemas = new Map();
  }

  /**
   * Registra un esquema de Zod para una herramienta específica
   * @param {string} toolName 
   * @param {import('zod').ZodSchema} schema 
   */
  registerSchema(toolName, schema) {
    this.schemas.set(toolName, schema);
  }

  /**
   * Valida los argumentos de una herramienta
   * @param {string} toolName 
   * @param {any} args 
   * @returns {ValidationResult}
   */
  validate(toolName, args) {
    const schema = this.schemas.get(toolName);

    if (!schema) {
      return new ValidationResult(false, [`Tool '${toolName}' not found in schema registry.`]);
    }

    if (typeof args !== 'object' || args === null || Array.isArray(args)) {
      return new ValidationResult(false, [`Arguments for '${toolName}' must be a JSON object, got ${typeof args}.`]);
    }

    const result = schema.safeParse(args);

    if (!result.success) {
      const errors = result.error.issues.map(issue => {
        const path = issue.path.join('.');
        return `${path}: ${issue.message}`;
      });
      return new ValidationResult(false, errors);
    }

    return new ValidationResult(true, [], result.data);
  }
}