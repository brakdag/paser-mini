import { z } from "zod";

export const listSchema = z
  .object({
    repo: z.string().optional(),
  })
  .strict();

export default listSchema;