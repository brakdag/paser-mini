import { loadZipSchema } from './loadZipSchema.js';
import { readZipFileSchema } from './readZipFileSchema.js';
import { writeZipFileSchema } from './writeZipFileSchema.js';
import { saveZipSchema } from './saveZipSchema.js';
import { listZipFilesSchema } from './listZipFilesSchema.js';

export const ZIP_SCHEMAS = {
  'loadZip': loadZipSchema,
  'readZipFile': readZipFileSchema,
  'writeZipFile': writeZipFileSchema,
  'saveZip': saveZipSchema,
  'listZipFiles': listZipFilesSchema,
};

export function registerAllSchemas(validator) {
  for (const [toolName, schema] of Object.entries(ZIP_SCHEMAS)) {
    validator.registerSchema(toolName, schema);
  }
}