import { z } from 'zod';

export const removeFileSchema = z.object({
  path: z.string(),
}).strict();
