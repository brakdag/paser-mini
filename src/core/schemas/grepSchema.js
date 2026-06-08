import { z } from "zod";

export const grepSchema = z
  .object({
    query: z.string(),
  })
  .strict();

export default grepSchema;