import { z } from "zod";

export const arrangeSchema = z
  .object({
    file_path: z.string(),
    path: z.string(),
  })
  .strict();

export default arrangeSchema;