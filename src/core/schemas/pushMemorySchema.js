--- HASH: 5aa5b70e37dad21e218cafc2dd05db232562611dcdfc410aa8e747088b41bb9b ---
import { z } from 'zod';

export const pushMemorySchema = z.object({
  value: z.string(),
  role: z.string().optional(),
  scope: z.string().optional(),
  key: z.string().optional(),
}).strict();
