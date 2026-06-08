import { z } from "zod";

export const diffSchema = z
  .object({
    path: z.string(),
  })
  .strict();

export default diffSchema;