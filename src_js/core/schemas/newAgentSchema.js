import { z } from 'zod';

export const newAgentSchema = z.object({
  message: z.string(),
  args: z.array(z.string()),
}).strict();
