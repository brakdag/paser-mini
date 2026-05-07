export const writeZipFileSchema = {
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "zipId": { "type": "string" },
    "internalPath": { "type": "string" },
    "content": "string"
  },
  "required": ["zipId", "internalPath", "content"],
  "additionalProperties": false
};