import { z } from "zod";

const getJsonNodeSchema = z
  .object({
    file_path: z.string(),
    path: z.string(),
  })
  .strict();


export default getJsonNodeSchema;
