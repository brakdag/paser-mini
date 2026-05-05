import { z } from 'zod';

export const gitDiffSchema = z.object({
  path: z.string(),
}).strict();
