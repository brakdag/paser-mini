import { z } from "zod";

export const lsSchema = z
  .object({
    path: z.string(),
  })
  .strict();

export default lsSchema;