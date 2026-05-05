import { z } from 'zod';

export const analyzePyrightSchema = z.object({
  path: z.string(),
}).strict();
