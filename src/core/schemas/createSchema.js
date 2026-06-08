import { z } from "zod";

export const createSchema = z
  .object({
    title: z.string(),
    body: z.string(),
    repo: z.string().optional(),
  })
  .strict();

export default createSchema;