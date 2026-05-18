import { z } from "zod";

const insertSceneFountainSchema = z
  .object({
    scene: z.string(),
    action: z.string(),
  })
  .strict();


export default insertSceneFountainSchema;
