import { z } from "zod";

const evalSchema = z
  .object({
    code: z.string(),
  })
  .strict();


export default evalSchema;