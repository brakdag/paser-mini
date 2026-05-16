import { z } from "zod";

const gitDiffSchema = z
  .object({
    path: z.string(),
  })
  .strict();


export default gitDiffSchema;
