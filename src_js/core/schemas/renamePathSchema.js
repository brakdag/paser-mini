import { z } from 'zod';

export const renamePathSchema = z.object({
  origin: z.string(),
  destination: z.string(),
}).strict();
