import { z } from 'zod';

export const getJsonArrayInfoSchema = z.object({
  file_path: z.string(),
  path: z.string(),
}).strict();
