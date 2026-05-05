import { z } from 'zod';

export const runPythonSchema = z.object({
  script_path: z.string(),
  args: z.array(z.string()),
}).strict();
