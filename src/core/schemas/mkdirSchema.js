import { z } from "zod";

const createDirSchema = z
  .object({
    path: z.string(),
  })
  .strict();


export default createDirSchema;
