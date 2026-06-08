import { z } from "zod";

export const copySchema = z
  .object({
    origin: z.string(),
    destination: z.string(),
  })
  .strict();

export default copySchema;