import { z } from "zod";

export const json_valSchema = z
  .object({
    json_string: z.string(),
  })
  .strict();

export default json_valSchema;