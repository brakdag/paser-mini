import { z } from "zod";

const analyzeSchema = z
  .object({
    path: z.string(),
    query: z.string().optional(),
  })
  .strict();

export default analyzeSchema;