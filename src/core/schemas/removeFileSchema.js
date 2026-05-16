import { z } from "zod";

const removeFileSchema = z
  .object({
    path: z.string(),
  })
  .strict();


export default removeFileSchema;
