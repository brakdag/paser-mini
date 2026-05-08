import { z } from 'zod';

export const pushMemorySchema = z.object({
  value: z.string(),
  role: z.string().optional(),
  scope: z.string().optional(),
  key: z.string().optional(),
}).strict();
