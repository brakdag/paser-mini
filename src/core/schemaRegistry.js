import SchemaValidator from "./schemaValidator.js";
import SCHEMAS from "./schemas.js";
import logger from "./logger.js";

const validator = new SchemaValidator();

/**
 * Registers all schemas from the schemas module into the validator.
 * @returns {Promise<void>}
 */
async function registerSchemas() {
  try {
    Object.entries(SCHEMAS).forEach(([toolName, schema]) => {
      validator.registerSchema(toolName, schema);
    });
  } catch (e) {
    logger.error(`[SchemaRegistry] Critical error registering schemas: ${e.message}`);
  }
}

await registerSchemas();

export { registerSchemas };
export default validator;