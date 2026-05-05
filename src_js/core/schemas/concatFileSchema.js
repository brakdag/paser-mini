import { z } from 'zod';

export const concatFileSchema = z.object({
  destination: z.string(),
  source: z.string(),
}).strict();
