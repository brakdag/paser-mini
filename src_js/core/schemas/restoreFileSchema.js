import { z } from 'zod';

export const restoreFileSchema = z.object({
  path: z.string(),
}).strict();
