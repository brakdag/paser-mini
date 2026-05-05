import { z } from 'zod';

export const listDirSchema = z.object({
  path: z.string(),
}).strict();

export type ListDirArgs = z.infer<typeof listDirSchema>;