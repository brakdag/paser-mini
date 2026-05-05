import { z } from 'zod';

export const readFileSchema = z.object({
  path: z.string(),
}).strict();

export const ReadFileArgs = z.infer<typeof readFileSchema>;