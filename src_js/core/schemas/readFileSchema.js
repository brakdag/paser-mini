import { z } from 'zod';

export const readFileSchema = z.object({
  path: z.string(),
  tail: z.number().optional(),
}).strict();
