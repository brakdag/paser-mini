import { z } from 'zod';

export const seeImageSchema = z.object({
  path: z.string(),
  crop: z.array(z.number()).length(4).optional(),
}).strict();