import { z } from 'zod';

export const codeFormatterSchema = z.object({
  path: z.string(),
}).strict();
