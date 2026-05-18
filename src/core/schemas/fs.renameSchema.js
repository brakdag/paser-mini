import { z } from "zod";

const renamePathSchema = z
  .object({
    origin: z.string(),
    destination: z.string(),
  })
  .strict();


export default renamePathSchema;
