import { z } from "zod";

export const sceneSchema = z
  .object({
    scene: z.string(),
    action: z.string(),
  })
  .strict();

export default sceneSchema;