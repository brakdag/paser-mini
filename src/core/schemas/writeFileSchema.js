import { z } from 'zod';

export const writeFileSchema = z.object({
  path: z.string(),
  content: z.string(),
}).strict();
