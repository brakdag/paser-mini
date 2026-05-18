import { z } from "zod";

const getJsonStructureSchema = z
  .object({
    file_path: z.string(),
    path: z.string(),
  })
  .strict();


export default getJsonStructureSchema;
