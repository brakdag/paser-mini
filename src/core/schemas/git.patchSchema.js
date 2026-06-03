import { z } from "zod";

const gitPatchSchema = z
  .object({
    patch: z.string(),
  })
  .strict();

export default gitPatchSchema;
