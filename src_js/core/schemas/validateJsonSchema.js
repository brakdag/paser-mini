import { z } from 'zod';

export const validateJsonSchema = z.object({
  json_string: z.string(),
}).strict();
