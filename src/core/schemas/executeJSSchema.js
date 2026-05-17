import { z } from "zod";

const executeJSSchema = z
  .object({
    code: z.string(),
  })
  .strict();


export default executeJSSchema;
