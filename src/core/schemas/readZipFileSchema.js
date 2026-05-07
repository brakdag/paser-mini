export const readZipFileSchema = {
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "zipId": { "type": "string" },
    "internalPath": { "type": "string" }
  },
  "required": ["zipId", "internalPath"],
  "additionalProperties": false
};