import { z } from "zod";

export const pushSchema = z
  .object({
    data: z.any(),
  })
  .strict();

export default pushSchema;