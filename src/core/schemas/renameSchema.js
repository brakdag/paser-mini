import { z } from "zod";

export const renameSchema = z
  .object({
    origin: z.string(),
    destination: z.string(),
  })
  .strict();

export default renameSchema;