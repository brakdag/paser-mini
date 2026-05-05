import { z } from 'zod';

export const pushMemorySchema = z.object({
  scope: z.string(),
  value: z.string(),
  key: z.string(),
  pointers: z.array(z.string()),
}).strict();
