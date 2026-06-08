import { z } from "zod";

export const urlSchema = z.object({
  url: z.string().url("Invalid URL format"),
});

export default urlSchema;