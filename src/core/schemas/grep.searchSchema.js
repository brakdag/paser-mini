import { z } from "zod";

const searchTextGlobalSchema = z
  .object({
    query: z.string(),
  })
  .strict();


export default searchTextGlobalSchema;
