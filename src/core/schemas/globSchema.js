import { z } from "zod";

export const globSchema = z
  .object({
    pattern: z.string(),
  })
  .strict();

export default globSchema;