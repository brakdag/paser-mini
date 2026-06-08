import { z } from "zod";

export const gh_editSchema = z
  .object({
    issue_number: z.number().int(),
    repo: z.string().optional(),
    title: z.string().optional(),
    body: z.string().optional(),
  })
  .strict();

export default gh_editSchema;