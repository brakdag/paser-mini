import { z } from 'zod';

export const imgSchema = z.object({
  path: z.string(),
  crop: z.array(z.number()).length(4).optional(),
}).strict();

export default imgSchema;