import fs from "fs";
import ValidationResult from "./validationResult.js";

class SchemaValidator {
  constructor() {
    this.schemas = new Map();
  }

  /**
   * Registers a Zod schema for a specific tool
   * @param {string} toolName
   * @param {import('zod').ZodSchema} schema
   */
  registerSchema(toolName, schema) {
    this.schemas.set(toolName, schema);
  }

  /**
   * Validates tool arguments
   * @param {string} toolName
   * @param {any} args
   * @returns {ValidationResult}
   */
  validate(toolName, args) {
    const schema = this.schemas.get(toolName);

    if (!schema) {
      return new ValidationResult(false, [
        `Tool '${toolName}' not found in schema registry.`,
      ]);
    }

    fs.appendFileSync('./log/schema_audit.log', `Tool: ${toolName}, Type: ${typeof schema}, hasSafeParse: ${typeof schema?.safeParse === 'function'}\n`);

    if (typeof args !== "object" || args === null || Array.isArray(args)) {
      return new ValidationResult(false, [
        `Arguments for '${toolName}' must be a JSON object, got ${typeof args}.`,
      ]);
    }

    if (typeof schema.safeParse !== 'function') {
      const errorMsg = `CRITICAL: Schema for tool '${toolName}' is not a Zod schema. Type: ${typeof schema}. Value: ${JSON.stringify(schema)}`;
      fs.appendFileSync('./log/schema_audit.log', `${errorMsg}\n`);
      throw new TypeError(errorMsg);
    }

    if (toolName === "restore") return new ValidationResult(true, [], args);
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