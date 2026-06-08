import { z } from "zod";

export const gh_postSchema = z
  .object({
    issue_number: z.number().int(),
    body: z.string(),
    repo: z.string(),
  })
  .strict();

export default gh_postSchema;