import { z } from 'zod';

export const createIssueSchema = z.object({
  title: z.string(),
  body: z.string(),
  repo: z.string().optional(),
}).strict();
