import { z } from "zod";

export const restoreSchema = z
  .object({
    filepath: z.string(),
  })
  .strict();

export default restoreSchema;