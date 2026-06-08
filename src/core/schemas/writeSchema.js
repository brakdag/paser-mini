import { z } from "zod";

export const writeSchema = z
  .object({
    path: z.string(),
    content: z.string(),
  })
  .strict();

export default writeSchema;