import { z } from "zod";

const snapshotSchema = z
  .object({
    path: z.string(),
  })
  .strict();

export default snapshotSchema;