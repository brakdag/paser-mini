import { z } from "zod";

export const readSchema = z
  .object({
    path: z.string(),
    tail: z.number().optional(),
  })
  .strict();

export default readSchema;