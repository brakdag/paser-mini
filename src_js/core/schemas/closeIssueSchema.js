import { z } from 'zod';

export const closeIssueSchema = z.object({
  issue_number: z.number().int(),
  repo: z.string().optional(),
}).strict();
