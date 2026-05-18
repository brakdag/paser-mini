import { z } from "zod";

const replaceStringSchema = z
  .object({
    path: z.string(),
    search_text: z.string(),
    replace_text: z.string(),
  })
  .strict();


export default replaceStringSchema;
