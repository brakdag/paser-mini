import { z } from "zod";

export const json_updSchema = z
  .object({
    file_path: z.string(),
    path: z.string(),
    value: z.any(),
  })
  .strict();

export default json_updSchema;