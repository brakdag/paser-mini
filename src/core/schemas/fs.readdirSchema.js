import { z } from "zod";

const listDirSchema = z
  .object({
    path: z.string(),
  })
  .strict();


export default listDirSchema;
