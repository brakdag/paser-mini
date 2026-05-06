import { z } from 'zod';

export const lintCodeSchema = z.object({
  path: z.string().optional().default('.'),
});