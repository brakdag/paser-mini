import { z } from "zod";

const writeFileSchema = z
  .object({
    path: z.string(),
    content: z.string(),
  })
  .strict();


export default writeFileSchema;
