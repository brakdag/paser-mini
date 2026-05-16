import { z } from "zod";

const restoreFileSchema = z
  .object({
    path: z.string(),
  })
  .strict();


export default restoreFileSchema;
