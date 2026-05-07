import { z } from 'zod';

export const analyzeCodeSchema = z.object({
  path: z.string(),
}).strict();
