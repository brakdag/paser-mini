import { z } from "zod";

const pushMemorySchema = z
  .object({
    data: z.any(),
  })
  .strict();


export default pushMemorySchema;
