import { z } from 'zod';

export const postCommentSchema = z.object({
  issue_number: z.number().int(),
  body: z.string(),
}).strict();
