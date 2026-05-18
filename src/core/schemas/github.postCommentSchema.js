import { z } from "zod";

const postCommentSchema = z
  .object({
    issue_number: z.number().int(),
    body: z.string(),
    repo: z.string(),
  })
  .strict();


export default postCommentSchema;
