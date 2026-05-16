import { z } from "zod";

const closeIssueSchema = z
  .object({
    issue_number: z.number().int(),
    repo: z.string().optional(),
  })
  .strict();


export default closeIssueSchema;
