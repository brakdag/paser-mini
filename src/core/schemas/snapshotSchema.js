import { z } from "zod";

export const snapshotSchema = z
  .object({
    path: z.string(),
  })
  .strict();

export default snapshotSchema;