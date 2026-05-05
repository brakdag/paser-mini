import { z } from 'zod';

export const renamePathSchema = z.object({
  origen: z.string(),
  destino: z.string(),
}).strict();
