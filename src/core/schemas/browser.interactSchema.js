import { z } from 'zod';

export default z.object({
  url: z.string(),
  action: z.enum(['navigate', 'screenshot', 'click', 'type', 'scroll', 'inspect']),
  params: z.any(),
});