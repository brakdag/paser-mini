import { z } from 'zod';

export const copyFileSchema = z.object({
  origen: z.string(),
  destino: z.string(),
}).strict();
