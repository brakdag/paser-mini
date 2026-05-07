import { z } from 'zod';

export const searchTextGlobalSchema = z.object({
  query: z.string(),
}).strict();
