import { z } from 'zod';

export const generateDocsSchema = z.object({
  path: z.string().optional().default('.'),
  outputDir: z.string().optional().default('docs/api'),
});