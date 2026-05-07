import { z } from 'zod';

export const copyFileSchema = z.object({
  origin: z.string(),
  destination: z.string(),
}).strict();
