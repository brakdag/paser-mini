import { z } from 'zod';

export const getJsonStructureSchema = z.object({
  file_path: z.string(),
  path: z.string(),
}).strict();
