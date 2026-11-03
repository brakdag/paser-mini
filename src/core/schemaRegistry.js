import SchemaValidator from "./schemaValidator.js";
import TOOL_DEFINITIONS from "../infrastructure/toolDefinitions.js";
import logger from "./logger.js";

const validator = new SchemaValidator();

/**
 * Registers all schemas from the schemas module into the validator.
 * @returns {Promise<void>}
 */
async function registerSchemas() {
  try {
    Object.entries(TOOL_DEFINITIONS).forEach(([toolName, definition]) => {
      validator.registerSchema(toolName, definition.schema);
    });
  } catch (e) {
    logger.error(`[SchemaRegistry] Critical error registering schemas: ${e.message}`);
    throw e;
  }
}

await registerSchemas();

export { registerSchemas };
export default validator;
