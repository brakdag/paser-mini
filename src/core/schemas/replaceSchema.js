import { z } from "zod";

export const replaceSchema = z
  .object({
    path: z.string(),
    search_text: z.string(),
    replace_text: z.string(),
  })
  .strict();

export default replaceSchema;