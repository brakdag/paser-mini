import { z } from "zod";

export const resetSchema = z
  .object({
    user_message: z.string(),
  })
  .strict();

export default resetSchema;