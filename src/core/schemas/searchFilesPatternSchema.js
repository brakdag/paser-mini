import { z } from 'zod';

export const searchFilesPatternSchema = z.object({
  pattern: z.string(),
}).strict();
