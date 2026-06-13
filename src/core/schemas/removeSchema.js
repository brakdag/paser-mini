import { z } from "zod";

export const removeSchema = z
  .object({
    path: z.string(),
  })
  .strict();

export default removeSchema;

