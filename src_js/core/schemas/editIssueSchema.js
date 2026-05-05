import { z } from 'zod';

export const editIssueSchema = z.object({
  issue_number: z.number().int(),
  repo: z.string().optional(),
  title: z.string().optional(),
  body: z.string().optional(),
}).strict();
