import { z } from "zod";

const createIssueSchema = z
  .object({
    title: z.string(),
    body: z.string(),
    repo: z.string().optional(),
  })
  .strict();


export default createIssueSchema;
