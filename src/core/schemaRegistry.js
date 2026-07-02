import SchemaValidator from "./schemaValidator.js";
import SCHEMAS from "./schemas.js";

const validator = new SchemaValidator();

/**
 *
 */
async function registerSchemas() {
  try {
    Object.entries(SCHEMAS).forEach(([toolName, schema]) => {
      validator.registerSchema(toolName, schema);
    });
  } catch (e) {
    console.error(`[SchemaRegistry] Critical error registering schemas: ${e.message}`);
  }
}

await registerSchemas();

export { registerSchemas };
export default validator;