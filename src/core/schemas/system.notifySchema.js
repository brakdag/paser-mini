import { z } from "zod";

const notifyUserSchema = z
  .object({
    message: z.string(),
  })
  .strict();


export default notifyUserSchema;
