import { z } from "zod";

export const restoreSchema = z
  .object({
    path: z.string(),
  })
  .strict();

export default restoreSchema;