import { z } from "zod";

const concatFileSchema = z
  .object({
    destination: z.string(),
    source: z.string(),
  })
  .strict();


export default concatFileSchema;
