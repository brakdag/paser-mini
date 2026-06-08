import { z } from "zod";

export const analysisSchema = z
  .object({
    path: z.string(),
  })
  .strict();

export default analysisSchema;