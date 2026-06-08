import { z } from "zod";

export const closeSchema = z
  .object({
    issue_number: z.number().int(),
    repo: z.string().optional(),
  })
  .strict();

export default closeSchema;