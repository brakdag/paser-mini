import { z } from 'zod';

export const pullMemorySchema = z.object({
  scope: z.string().optional(),
  key: z.string().optional(),
  direction: z.string().optional(),
}).strict();
