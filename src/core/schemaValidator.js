import ValidationResult from "./validationResult.js";

/**
 * Validates tool arguments against registered Zod schemas to ensure type safety and structural integrity.
 */
class SchemaValidator {
  /**
   * Initializes the SchemaValidator with an empty registry of schemas.
   * @returns {void}
   */
  constructor() {
    this.schemas = new Map();
  }

  /**
   * Registers a Zod schema for a specific tool.
   * @param {string} toolName - The unique identifier of the tool.
   * @param {import('zod').ZodSchema} schema - The Zod schema used for validation.
   * @returns {void}
   */
  registerSchema(toolName, schema) {
    this.schemas.set(toolName, schema);
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

    const result = schema.safeParse(args);

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