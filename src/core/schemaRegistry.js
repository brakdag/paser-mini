import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { SchemaValidator } from './schemaValidator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SCHEMAS_DIR = path.join(__dirname, 'schemas');

const validator = new SchemaValidator();

async function registerSchemas() {
  try {
    const files = fs.readdirSync(SCHEMAS_DIR);
    
    for (const file of files) {
      if (file.endsWith('.js')) {
        const schemaName = file.replace('.js', '').replace('Schema', '');
        const toolName = schemaName;
        
        try {
          const module = await import(`./schemas/${file}`);
          const schema = module[schemaName + 'Schema'];
          
          if (schema) {
            validator.registerSchema(toolName, schema);
          } else {
            console.error(`[SchemaRegistry] Warning: No export named ${schemaName + 'Schema'} found in ${file}`);
          }
        } catch (e) {
          console.error(`[SchemaRegistry] Error loading schema ${file}: ${e.message}`);
        }
      }
    }
  } catch (e) {
    console.error(`[SchemaRegistry] Critical error reading schemas directory: ${e.message}`);
  }
}

// Top-level await ensures all schemas are registered before the validator is exported
await registerSchemas();

export default validator;