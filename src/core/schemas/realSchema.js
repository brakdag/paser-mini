import { z } from 'zod';

export const realSchema = z.object({
  action: z.string(),
}).strict();

export default realSchema;