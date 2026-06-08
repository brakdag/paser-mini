import { z } from "zod";

export const valideSchema = z
  .object({
    json_string: z.string(),
  })
  .strict();

export default valideSchema;