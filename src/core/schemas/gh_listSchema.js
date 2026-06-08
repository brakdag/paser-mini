import { z } from "zod";

export const gh_listSchema = z
  .object({
    repo: z.string().optional(),
  })
  .strict();

export default gh_listSchema;