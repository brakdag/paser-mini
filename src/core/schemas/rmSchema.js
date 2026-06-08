import { z } from "zod";

export const rmSchema = z
  .object({
    path: z.string(),
  })
  .strict();

export default rmSchema;