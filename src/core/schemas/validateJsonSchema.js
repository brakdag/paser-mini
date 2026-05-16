import { z } from "zod";

const validateJsonSchema = z
  .object({
    json_string: z.string(),
  })
  .strict();


export default validateJsonSchema;
