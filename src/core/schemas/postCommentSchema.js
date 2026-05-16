import { z } from "zod";

const postCommentSchema = z
  .object({
    issue_number: z.number().int(),
    body: z.string(),
  })
  .strict();


export default postCommentSchema;
