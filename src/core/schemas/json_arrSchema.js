import { z } from "zod";

export const json_arrSchema = z
  .object({
    file_path: z.string(),
    path: z.string(),
  })
  .strict();

export default json_arrSchema;