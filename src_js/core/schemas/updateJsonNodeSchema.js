import { z } from 'zod';

export const updateJsonNodeSchema = z.object({
  file_path: z.string(),
  path: z.string(),
  value: z.any(),
}).strict();
