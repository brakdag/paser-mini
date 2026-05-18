import { z } from "zod";

const listIssuesSchema = z
  .object({
    repo: z.string().optional(),
  })
  .strict();


export default listIssuesSchema;
