import ValidationResult from "./validationResult.js";
import normalizeArgumentNames from "./toolArguments.js";

/**
 * Validates tool arguments against registered Zod schemas to ensure type safety and structural integrity.
 */
class SchemaValidator {
  /**
   * Initializes the SchemaValidator with an empty registry of schemas.
   */
  constructor() {
    this.schemas = new Map();
    this.aliases = new Map();
  }

  /**
   * Registers a Zod schema for a specific tool.
   * @param {string} toolName - The unique identifier of the tool.
   * @param {import('zod').ZodSchema} schema - The Zod schema used for validation.
   * @param {Record<string, string>} [aliases] - Supported legacy argument names.
   * @returns {void}
   */
  registerSchema(toolName, schema, aliases = {}) {
    this.schemas.set(toolName, schema);
    this.aliases.set(toolName, aliases);
  }

  /**
   * Validates tool arguments against the registered schema for the given tool.
   * @param {string} toolName - The name of the tool whose arguments are being validated.
   * @param {unknown} args - The arguments to validate.
   * @returns {ValidationResult} An object containing the validation status, any error messages, and the parsed data.
   */
  validate(toolName, args) {
    const schema = this.schemas.get(toolName);

    if (!schema) {
      return new ValidationResult(false, [
        `Tool '${toolName}' not found in schema registry.`,
      ]);
    }

    if (typeof args !== "object" || args === null || Array.isArray(args)) {
      return new ValidationResult(false, [
        `Arguments for '${toolName}' must be a JSON object, got ${typeof args}.`,
      ]);
    }

    if (typeof schema.safeParse !== 'function') {
      const errorMsg = `CRITICAL: Schema for tool '${toolName}' is not a Zod schema. Type: ${typeof schema}. Value: ${JSON.stringify(schema)}`;
      throw new TypeError(errorMsg);
    }

    let normalized;
    try {
      normalized = normalizeArgumentNames(args, this.aliases.get(toolName));
    } catch (error) {
      return new ValidationResult(false, [error.message]);
    }
    const result = schema.safeParse(normalized);

    if (!result.success) {
      const errors = result.error.issues.map((issue) => {
        const path = issue.path.join(".");
        return `${path}: ${issue.message}`;
      });
      return new ValidationResult(false, errors);
    }

    return new ValidationResult(true, [], result.data);
  }
}

export default SchemaValidator;
