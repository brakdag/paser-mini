import { z } from "zod";

export const json_nodeSchema = z
  .object({
    file_path: z.string(),
    path: z.string(),
  })
  .strict();

export default json_nodeSchema;