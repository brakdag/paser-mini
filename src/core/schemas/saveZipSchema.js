export const saveZipSchema = {
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "zipId": { "type": "string" },
    "outputPath": { "type": "string" }
  },
  "required": ["zipId", "outputPath"],
  "additionalProperties": false
};