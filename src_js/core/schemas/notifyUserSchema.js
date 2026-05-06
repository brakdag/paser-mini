import { z } from 'zod';

export const notifyUserSchema = z.object({
  message: z.string(),
}).strict();
