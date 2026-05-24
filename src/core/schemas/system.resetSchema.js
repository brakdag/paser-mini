import { z } from "zod";

const resetSchema = z
  .object({
    user_message: z.string(),
  })
  .strict();

export default resetSchema;