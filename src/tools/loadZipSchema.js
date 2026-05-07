import { z } from 'zod';

export const loadZipSchema = z.object({
  filePath: z.string().describe('The path to the ZIP file to load into RAM')
});