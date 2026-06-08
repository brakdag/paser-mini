import { z } from "zod";

export const concatSchema = z
  .object({
    destination: z.string(),
    source: z.string(),
  })
  .strict();

export default concatSchema;