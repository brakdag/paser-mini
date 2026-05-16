import { z } from "zod";

export const insertSceneFountainSchema = z
  .object({
    scene: z.string(),
    action: z.string(),
  })
  .strict();
