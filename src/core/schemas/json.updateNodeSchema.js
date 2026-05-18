import { z } from "zod";

const updateJsonNodeSchema = z
  .object({
    file_path: z.string(),
    path: z.string(),
    value: z.any(),
  })
  .strict();


export default updateJsonNodeSchema;
