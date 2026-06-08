import { z } from "zod";

export const updateSchema = z
  .object({
    file_path: z.string(),
    path: z.string(),
    value: z.any(),
  })
  .strict();

export default updateSchema;