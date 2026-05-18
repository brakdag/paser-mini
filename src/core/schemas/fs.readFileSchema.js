import { z } from "zod";

const readFileSchema = z
  .object({
    path: z.string(),
    tail: z.number().optional(),
  })
  .strict();


export default readFileSchema;
