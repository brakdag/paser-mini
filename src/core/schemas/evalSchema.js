export const evalSchema = {
  type: "object",
  properties: {
    code: { type: "string" }
  },
  required: ["code"],
  additionalProperties: false,
};