import { z } from "zod";

export const astSchema = z
  .object({
    path: z.string(),
    query: z.string(),
    limit: z.number().optional(),
  })
  .strict();

export default astSchema;