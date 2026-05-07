import { z } from 'zod';

export const listIssuesSchema = z.object({
  repo: z.string().optional(),
}).strict();
