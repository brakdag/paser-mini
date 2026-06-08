import { z } from "zod";

export const postSchema = z
  .object({
    issue_number: z.number().int(),
    body: z.string(),
    repo: z.string(),
  })
  .strict();

export default postSchema;