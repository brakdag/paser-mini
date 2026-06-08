import { z } from "zod";

export const patchSchema = z
  .object({
    patch: z.string(),
  })
  .strict();

export default patchSchema;