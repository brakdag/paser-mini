import { z } from 'zod';

export const writeZipFileSchema = z.object({
  zipId: z.string().describe('The ID of the loaded ZIP container'),
  internalPath: z.string().describe('The path of the file inside the ZIP to update or create'),
  content: z.string().describe('The new content for the file')
});