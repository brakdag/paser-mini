import { z } from "zod";

export const notifySchema = z
  .object({
    message: z.string(),
  })
  .strict();

export default notifySchema;