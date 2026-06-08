import { z } from "zod";

export const gh_closeSchema = z
  .object({
    issue_number: z.number().int(),
    repo: z.string().optional(),
  })
  .strict();

export default gh_closeSchema;