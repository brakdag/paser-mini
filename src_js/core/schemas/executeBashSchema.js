import { z } from 'zod';

export const executeBashSchema = z.object({
  command: z.string(),
});