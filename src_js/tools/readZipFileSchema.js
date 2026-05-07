import { z } from 'zod';

export const readZipFileSchema = z.object({
  zipId: z.string().describe('The ID of the loaded ZIP container'),
  internalPath: z.string().describe('The path of the file inside the ZIP to read')
});