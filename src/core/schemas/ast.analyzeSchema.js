import { z } from "zod";

const analyzeSchema = z
  .object({
    path: z.string(),
    query: z.string(),
    limit: z.number().optional(),
  })
  .strict();

export default analyzeSchema;