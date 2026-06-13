import { z } from "zod";

export const readSchema = z
  .object({
    path: z.string(),
    tail: z.union([z.number(), z.string()]).optional(),
  })
  .strict();

export default readSchema;