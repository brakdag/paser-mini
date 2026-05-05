import { SchemaValidator } from './schemaValidator.js';
import { readFileSchema } from './schemas/readFileSchema.js';
import { writeFileSchema } from './schemas/writeFileSchema.js';
import { listDirSchema } from './schemas/listDirSchema.js';

const validator = new SchemaValidator();

// Registro de esquemas
validator.registerSchema('read_file', readFileSchema);
validator.registerSchema('write_file', writeFileSchema);
validator.registerSchema('list_dir', listDirSchema);

export default validator;