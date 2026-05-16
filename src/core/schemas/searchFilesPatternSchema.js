import { z } from "zod";

const searchFilesPatternSchema = z
  .object({
    pattern: z.string(),
  })
  .strict();


export default searchFilesPatternSchema;
