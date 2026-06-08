import { z } from "zod";

export const gh_createSchema = z
  .object({
    title: z.string(),
    body: z.string(),
    repo: z.string().optional(),
  })
  .strict();

export default gh_createSchema;