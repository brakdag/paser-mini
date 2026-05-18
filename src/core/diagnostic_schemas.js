import validator from './src/core/schemaRegistry.js';

const audit = [];
for (const [toolName, schema] of validator.schemas.entries()) {
  audit.push({
    tool: toolName,
    type: typeof schema,
    hasSafeParse: typeof schema?.safeParse === 'function',
    constructor: schema?.constructor?.name
  });
}
console.log(JSON.stringify(audit, null, 2));