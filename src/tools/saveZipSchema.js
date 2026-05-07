import { z } from 'zod';

export const saveZipSchema = z.object({
  zipId: z.string().describe('The ID of the loaded ZIP container'),
  outputPath: z.string().describe('The path where the ZIP should be saved on disk')
});