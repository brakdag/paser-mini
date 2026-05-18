import { z } from "zod";

const getJsonArrayInfoSchema = z
  .object({
    file_path: z.string(),
    path: z.string(),
  })
  .strict();


export default getJsonArrayInfoSchema;
