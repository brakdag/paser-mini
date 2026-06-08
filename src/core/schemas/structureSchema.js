import { z } from "zod";

export const structureSchema = z
  .object({
    file_path: z.string(),
    path: z.string(),
  })
  .strict();

export default structureSchema;