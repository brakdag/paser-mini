import { z } from "zod";

export const nodeSchema = z
  .object({
    file_path: z.string(),
    path: z.string(),
  })
  .strict();

export default nodeSchema;