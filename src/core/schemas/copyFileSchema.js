import { z } from "zod";

const copyFileSchema = z
  .object({
    origin: z.string(),
    destination: z.string(),
  })
  .strict();


export default copyFileSchema;
