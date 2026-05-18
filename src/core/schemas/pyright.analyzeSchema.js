import { z } from "zod";

const analyzeCodeSchema = z
  .object({
    path: z.string(),
  })
  .strict();


export default analyzeCodeSchema;
