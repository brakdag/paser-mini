import { z } from 'zod';

export const getJsonNodeSchema = z.object({
  file_path: z.string(),
  path: z.string(),
}).strict();
