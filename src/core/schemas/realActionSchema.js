import { z } from 'zod';

const realActionSchema = z.object({
  action: z.string(),
}).strict();

export default realActionSchema;
