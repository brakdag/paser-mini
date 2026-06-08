import { z } from "zod";

export const runSchema = z
  .object({
    code: z.string(),
  })
  .strict();

export default runSchema;