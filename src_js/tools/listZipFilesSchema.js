import { z } from 'zod';

export const listZipFilesSchema = z.object({
  zipId: z.string().describe('The ID of the loaded ZIP container')
});