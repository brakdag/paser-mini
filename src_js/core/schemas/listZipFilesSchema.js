export const listZipFilesSchema = {
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "zipId": { "type": "string" }
  },
  "required": ["zipId"],
  "additionalProperties": "false"
};